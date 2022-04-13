const { ethers } = require("ethers");

const generateWinners = ({
    rewards,
    participants,
    seedNumber
}) => {

    const totalWinners = rewards.length

    participants = participants.sort()

    let output = []

    while (true) {

        const index = (ethers.BigNumber.from(`${seedNumber}`).mod(ethers.BigNumber.from(participants.length)))

        if (output.indexOf(output[Number(index)]) === -1) {
            output.push(participants[Number(index)])
        }

        seedNumber = ethers.BigNumber.from(ethers.utils.keccak256(ethers.BigNumber.from(`${seedNumber}`))).toString()

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

        return await Promise.all(winners.map(item => getAsset(item)))

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

module.exports = {
    generateWinners,
    finalizeWinners,
    getProvider
}