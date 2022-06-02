

const { ethers } = require("ethers");

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

module.exports = {
    generateWinners,
    finalizeWinners,
    getProvider,
    parseBody,

}