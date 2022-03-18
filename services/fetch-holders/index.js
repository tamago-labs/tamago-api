#!/usr/bin/env node

require("dotenv").config();
const retry = require("async-retry");
const logger = require('loglevel');

var AWS = require('aws-sdk');

AWS.config.loadFromPath('./config.json');

logger.enableAll()

const { Holders } = require("./holders")
const { delay, getProvider } = require("../")

// Create DynamoDB document client
const docClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

async function run({
    pollingDelay,
    queryDelay,
    queryInterval,
    errorRetries,
    errorRetriesTimeout,
    project,
    saveToDb,
    dbTableName
}) {

    try {

        const { CHAIN_ID, ID, ASSETS, ARCHIVE } = require(`../../projects/${project}/constants`)

        let rpcUrl

        switch (CHAIN_ID) {
            case 137:
                rpcUrl = process.env.POLYGON_RPC_SERVER
                break;
            case 1:
                rpcUrl = process.env.MAINNET_RPC_SERVER
            default:
                break;
        }

        if (!rpcUrl) {
            throw new Error(`No RPC config on environment variables for chain : ${CHAIN_ID}`)
        }

        const provider = getProvider(rpcUrl)

        const holders = new Holders({
            logger,
            provider,
            queryDelay,
            queryInterval,
            projectId: ID,
            assets: ASSETS,
            chainId: CHAIN_ID,
            archive: ARCHIVE
        })

        while (true) {
            await retry(
                async () => {

                    // Update holders data
                    await holders.update()

                    const currentHolders = holders.getHolders()

                    logger.debug(`Total holders for the collection : ${currentHolders.length} `)

                    if (saveToDb) {
                        const Item = {
                            projectId: Number(ID),
                            timestamp: Math.floor(new Date().valueOf() / 1000),
                            holders: currentHolders
                        };

                        const TableName = `${dbTableName}`

                        logger.debug(`Saving the holder list to DynamoDB table - ${TableName}`)

                        await docClient.put({ TableName, Item }).promise();
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

            logger.debug("End of execution loop - waiting polling delay")

            await delay(Number(pollingDelay));
        }

    } catch (error) {
        // If any error is thrown, catch it and bubble up to the main try-catch for error processing in the Poll function.
        throw typeof error === "string" ? new Error(error) : error;
    }

}

async function Poll(callback) {
    try {

        const args = process.argv.slice(2);

        if (!args[0]) {
            throw new Error("Please provide your project key, ex. 'yarn run fetch-holders 1-tamago-original'")
        }

        const executionParameters = {
            pollingDelay: 60 * 10,
            queryDelay: 40,
            queryInterval: {
                137: 40000,
                1: 4000
            },
            saveToDb: false,
            dbTableName : "luckboxTable-5693aad",
            errorRetries: 5,
            errorRetriesTimeout: 10,
            project: args[0] // 1-tamago-original
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
