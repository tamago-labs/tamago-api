const { ethers } = require("ethers");

const finalizeWinners = ({
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

    return rewards.map(( rewardId, index) => {
        return [ rewardId, output[index]]
    })
}

module.exports = {
    finalizeWinners
}