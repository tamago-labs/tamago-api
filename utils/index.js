const Moralis = require("moralis/node")

const { ethers } = require("ethers");
const { SUPPORT_MAINNET, SUPPORT_TESTNET } = require("../constants");
const { even } = require("check-types");


const generateWinners = ({
    rewards,
    participants,
    seedNumber
}) => {

    console.log("Generating winner list : ", rewards, participants, seedNumber)

    const totalWinners = rewards.length

    participants = participants.sort()

    let output = []

    while (true) {

        const index = ((ethers.utils.bigNumberify(`${seedNumber}`)).mod(ethers.utils.bigNumberify((`${participants.length}`))))

        if (output.indexOf(participants[Number(index)]) === -1) {
            output.push(participants[Number(index)])
        }

        seedNumber = `${ethers.utils.bigNumberify(`${ethers.utils.keccak256(ethers.utils.bigNumberify(`${seedNumber}`))}`)}`

        if (output.length >= totalWinners) {
            break
        }
    }

    return rewards.map((rewardId, index) => {
        return [rewardId, output[index]]
    })
}

const finalizeWinners = async (luckboxContract, { seedNumber, winners }) => {
    if (seedNumber !== "0" && winners && winners.length > 0) {

        const getAsset = async (item) => {

            const assetInfo = await luckboxContract.poaps(item[0])

            return {
                "rewardId": item[0],
                "assetAddress": assetInfo[0],
                "winnerAddress": item[1],
                "tokenId": assetInfo[1].toString(),
                "assetIs1155": assetInfo[2]
            }
        }

        return await Promise.all(winners.splice(0, 20).map(item => getAsset(item)))

    } else {
        return []
    }
}

const getProvider = (chainId = 137) => {

    let rpcUrl

    switch (chainId) {
        case 137:
            rpcUrl = process.env.POLYGON_RPC_SERVER || "https://polygon-mainnet.g.alchemy.com/v2/jucVpnvhzklnSjwTPXs5sTdz3IkIELwx"
            break;
        case 1:
            rpcUrl = process.env.MAINNET_RPC_SERVER || "https://nd-454-395-901.p2pify.com/aa03c13657e5ccc30a12bba624297b80"
        default:
            break;
    }

    if (!rpcUrl) {
        throw new Error("can't find RPC URL configuration for given chain ID")
    }

    return new ethers.providers.JsonRpcProvider(rpcUrl)
}

const parseBody = (event) => {
    let { body, isBase64Encoded } = event

    if (isBase64Encoded === true) {
        const base64String = body
        const buff = Buffer.from(base64String, "base64");
        const eventBodyStr = buff.toString('UTF-8');
        body = JSON.parse(eventBodyStr);
    } else {
        body = JSON.parse(body);
    }
    return body
}

const base64ToImage = (dataurl, filename) => {

    // var arr = dataurl.split(','),
    //     mime = arr[0].match(/:(.*?);/)[1],
    //     bstr = atob(arr[1]),
    //     n = bstr.length,
    //     u8arr = new Uint8Array(n);

    // while (n--) {
    //     u8arr[n] = bstr.charCodeAt(n);
    // }

    // let extension = ""
    // switch (arr[1][0]) {
    //     case '/': extension = '.jpg'
    //         break;
    //     case 'i': extension = '.png'
    //         break;
    //     case 'R': extension = '.gif'
    //         break;
    //     case 'U': extension = '.webp'
    //         break;

    // }

    // return new File([u8arr], filename + extension, { type: mime });
}

const generateMoralisParams = (chainId) => {
    if (SUPPORT_TESTNET.indexOf(chainId) !== -1) {
        return {
            serverUrl: "https://1ovp3qunsgo4.usemoralis.com:2053/server",
            appId: "enCW1fXy8eMazgGNIgwKdOicHVw67k0AegYAr2eE",
            masterKey: "AdNlpYjZuuiCGzlPaonWrJoGSIB6Scnae2AiNY6B"
        }
    }
    if (SUPPORT_MAINNET.indexOf(chainId) !== -1) {
        return {
            serverUrl: "https://cybgqjtb97zb.usemoralis.com:2053/server",
            appId: "c5pJEepQAhugEYhT4xmn5FUvWRij5Rvbpn7yZGJ9",
            masterKey: "1OKt4BCqp7OcDwKmJGmrJTBeadyhfyznSrFnU1IB"
        }
    }
    throw new Error("Chain isn't supported")
}


const BURNT_ADDRESSES = ["0x000000000000000000000000000000000000dEaD", "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000001"]

const isNotBurnAddress = (address) => {
    return (BURNT_ADDRESSES.map(item => item.toLowerCase()).indexOf(address.toLowerCase()) === -1)
}

const walletsToHolders = (wallets) => {
    // filter the holder who has no NFTs in their wallet

    const holders = Object.keys(wallets).reduce((output, item) => {

        let itemCount = 0

        const ids = Object.keys(wallets[item])

        for (let id of ids) {
            if (wallets[item][id] > 0) {
                itemCount += 1
            }
        }

        if (itemCount !== 0 && isNotBurnAddress(item)) {
            output.push(item)
        }

        return output
    }, [])

    const ids = Object.keys(wallets).reduce((output, item) => {
        const ids = Object.keys(wallets[item])
        for (let id of ids) {
            if (output.indexOf(id) === -1) {
                output.push(id)
            }
        }
        return output
    }, [])

    return {
        holders,
        ids
    }
}

const fetchQuery = async (query, timestamp) => {
    query.limit(1000)

    if (timestamp) {
        query.lessThan("block_timestamp", new Date(timestamp * 1000))
    }

    let evts = []
    let isMore = true
    let count = 0

    while (isMore) {
        query.skip(1000 * count)
        const events = await query.find();
        if (events.length !== 1000) {
            isMore = false
        }
        evts = evts.concat(events)
        count += 1
    }

    return evts
}

const collectErc721Holders = async (chainId, tableName, timestamp) => {

    await Moralis.start(generateMoralisParams(chainId))

    const Events = Moralis.Object.extend(`${tableName}`);
    const transferQuery = new Moralis.Query(Events);

    const transferEvents = await fetchQuery(transferQuery, timestamp)

    console.log(`Total : ${transferEvents.length} events`)

    const parsed = transferEvents.map(event => [event.get("from"), event.get("to"), (event.get("tokenId")).toString()]) // sender, recipient, tokenId

    const wallets = parsed.reduce((json, event) => {
        // set intial values 
        if (!json[event[1]]) json[event[1]] = {}
        if (!(json[event[1]][event[2]])) json[event[1]][event[2]] = 0
        if (!json[event[0]]) json[event[0]] = {}
        if (!(json[event[0]][event[2]])) json[event[0]][event[2]] = 0

        // debit the recipient
        json[event[1]][event[2]] += 1
        // deduct the sender
        json[event[0]][event[2]] -= 1
        return json
    }, {})

    return walletsToHolders(wallets)
}

const collectErc1155Holders = async (chainId, tableName, timestamp) => {

    await Moralis.start(generateMoralisParams(chainId))

    const EventsSingle = Moralis.Object.extend(`${tableName}Single`);
    let transferSingleQuery = new Moralis.Query(EventsSingle);

    const transferSingleEvents = await fetchQuery(transferSingleQuery, timestamp)

    const EventsBatch = Moralis.Object.extend(`${tableName}Batch`);
    let transferBatchQuery = new Moralis.Query(EventsBatch);
    const transferBatchEvents = await fetchQuery(transferBatchQuery, timestamp)

    console.log(`Total : ${transferSingleEvents.length + transferBatchEvents.length} events`)

    const parsedBatchEvents = transferBatchEvents.map(event => [event.get("from"), event.get("to"), event.get("ids"), event.get("values")])
    const parsedSingleEvents = transferSingleEvents.map(event => [event.get("from"), event.get("to"), [event.get("id")], [event.get("value")]])

    const wallets = (parsedBatchEvents.concat(parsedSingleEvents)).reduce((json, event) => {
        // set intial values 
        if (!json[event[1]]) json[event[1]] = {}
        if (!json[event[0]]) json[event[0]] = {}
        for (let tokenId of event[2]) {
            if (!(json[event[1]][tokenId])) json[event[1]][tokenId] = 0
            if (!(json[event[0]][tokenId])) json[event[0]][tokenId] = 0

            // debit the recipient
            json[event[1]][tokenId] += Number(event[3])
            // deduct the sender
            json[event[0]][tokenId] -= Number(event[3])

        }

        return json
    }, {})

    return walletsToHolders(wallets)
}

module.exports = {
    generateWinners,
    finalizeWinners,
    getProvider,
    parseBody,
    generateMoralisParams,
    collectErc721Holders,
    collectErc1155Holders
}