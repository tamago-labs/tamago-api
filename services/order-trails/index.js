#!/usr/bin/env node

require("dotenv").config();
const retry = require("async-retry");
const logger = require('loglevel');
const { ethers } = require("ethers")

let AWS = require('aws-sdk');

AWS.config.loadFromPath('./config.json');

logger.enableAll()

const { delay, getProvider } = require("../")
const { MARKETPLACES } = require("../../constants")
const { MARKETPLACE_ABI } = require("../../abi")

// Create DynamoDB document client
const docClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });


async function run({
    pollingDelay,
    errorRetries,
    errorRetriesTimeout,
    dbTableName
}) {

    try {

        await retry(
            async () => {

                // check order entries in the system
                let params = {
                    TableName: dbTableName,
                    KeyConditionExpression: "#version = :version",
                    ExpressionAttributeNames: {
                        "#version": "version"
                    },
                    ExpressionAttributeValues: {
                        ":version": 1
                    },
                    ProjectionExpression: "orderId, chainId, confirmed, visible, fulfilled, crosschain, canceled, locked"
                }

                const client = new AWS.DynamoDB.DocumentClient()
                const { Items } = await client.query(params).promise()

                const orders = Items.filter(item => item.confirmed && item.visible && !item.fulfilled && !item.canceled && !item.crosschain && !item.locked)

                logger.debug("total orders to be checked : ", orders.length)

                for (let order of orders) {

                    const { chainId, orderId } = order

                    if ([42].indexOf(chainId) !== -1) {

                        let rpcUrl

                        switch (chainId) {
                            case 42:
                                rpcUrl = process.env.KOVAN_RPC_SERVER
                            default:
                                break;
                        }

                        const provider = getProvider(rpcUrl)

                        const { contractAddress } = MARKETPLACES.find(item => chainId === chainId )

                        const contract = new ethers.Contract(contractAddress, MARKETPLACE_ABI  , provider)

                        const payload = await contract.orders(orderId)

                        // update order status
                        if (payload["ended"] === true) {

                            params = {
                                TableName: dbTableName,
                                Key: {
                                    "version": 1,
                                    "orderId": Number(orderId)
                                }
                            };
                    
                            const { Item } = await client.get(params).promise()

                            const NewItem = {
                                ...Item,
                                "fulfilled" : true
                            }

                            params = {
                                TableName: dbTableName,
                                Item: NewItem
                            }

                            logger.debug(`Order id : ${orderId} need to changing the fulfilled status`)

                            await client.put(params).promise()

                            logger.debug("Saved")

                        }   

                    }

                }

            },
            {
                retries: errorRetries,
                minTimeout: errorRetriesTimeout * 1000, // delay between retries in ms
                randomize: false,
                onRetry: error => {
                    console.log(error)
                    logger.debug(error.message)
                }
            }
        );


        logger.debug("End of execution loop ", (new Date()).toLocaleTimeString())
        await delay(Number(pollingDelay));
    }
    catch (error) {
        // If any error is thrown, catch it and bubble up to the main try-catch for error processing in the Poll function.
        throw typeof error === "string" ? new Error(error) : error;
    }

}


async function Poll(callback) {
    try {

        console.log("Start of process", (new Date()).toLocaleTimeString())

        if (!process.env.ORDER_TABLE_NAME) {
            throw new Error('dbTableName is required.')
        }

        const executionParameters = {
            pollingDelay: Number(process.env.POLLING_DELAY) || 60,
            queryDelay: Number(process.env.QUERY_DELAY) || 40,
            queryInterval: { 137: 40000, 1: 4000 },
            dbTableName: process.env.ORDER_TABLE_NAME,
            errorRetries: Number(process.env.ERROR_RETRIES) || 5,
            errorRetriesTimeout: Number(process.env.ERROR_RETRIES_TIMEOUT) || 10
        }

        await run({ ...executionParameters });

    } catch (error) {

        logger.error(error.message)

        callback(error)
    }
    callback()
}


function nodeCallback(err) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else process.exit(0);
}


// If called directly by node, execute the Poll Function. This lets the script be run as a node process.
if (require.main === module) {
    Poll(nodeCallback)
        .then(() => { })
        .catch(nodeCallback);
}