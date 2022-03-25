
const fs = require('fs')
const { ethers } = require("ethers")
const { delay } = require("..")
const { ERC721_ABI, ERC1155_ABI } = require("../../abi")


class Holders {

    INTERVALS = {
        137: 50000,
        1: 5000
    }

    BURNT_ADDRESSES = ["0x000000000000000000000000000000000000dEaD" , "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000001"]

    WALLETS = {}

    /*
    {
        ADDRESS : {
            TOKEN_ID : 1,
            TOKEN_ID : 2
        },
        ADDRESS : {
            TOKEN_ID : 3,
            TOKEN_ID : 4
        },
    }
    */

    constructor({
        logger,
        provider,
        queryDelay,
        queryInterval,
        projectId,
        assets,
        chainId,
        archive
    }) {

        this.logger = logger
        this.provider = provider

        this.logger.debug(`An instance is being created...`)

        // project related constants
        this.projectId = projectId
        this.assets = assets
        this.chainId = chainId

        this.DELAY = queryDelay
        this.INTERVALS = queryInterval

        // FIXME : support 1+ assets per project
        const { address, is1155, startBlock, useArchive } = assets[0]
        this.assetAddress = address
        this.assetIs1155 = is1155
        this.startBlock = startBlock

        if (useArchive) {
            if (!archive) throw new Error("Archive data for the collection is not set")
            this.WALLETS = archive
        }

        this.assetContract = new ethers.Contract(address, is1155 ? ERC1155_ABI : ERC721_ABI, provider)

    }

    async update() {

        this.logger.debug(`The asset address to be observed is ${this.assetAddress}`)

        const currentBlock = await this.provider.getBlockNumber()

        this.logger.debug(`Current block is : ${currentBlock}`)

        const interval = this.INTERVALS[this.chainId]
        const totalRound = Math.ceil((currentBlock - this.startBlock) / interval)

        for (let i = 0; i < totalRound; i++) {
            const from = this.startBlock + (i * interval)
            let to = this.startBlock + ((i + 1) * interval)

            if (to > currentBlock) {
                to = currentBlock
            }

            this.logger.debug(`Round ${i + 1}/${totalRound} from : ${from} until : ${to}`)

            if (this.assetIs1155) {
                await this.parseTransactionsErc1155(from, to)
            } else {
                await this.parseTransactionsErc721(from, to)
            }

            // uncomment to print out round data
            // this.printout(`${this.projectId}_Round_${i+1}_${to}_${(new Date()).valueOf()}`, JSON.stringify(this.WALLETS))

            await delay(this.DELAY)
        }

        // uncomment to print out archive data
        // this.printout(`${this.projectId}_Final_${(new Date()).valueOf()}`, JSON.stringify(this.WALLETS))
    }

    async parseTransactionsErc721(fromBlock, toBlock) {

        const events = await this.assetContract.queryFilter(this.assetContract.filters.Transfer(null, null, null), fromBlock, toBlock);
        this.logger.debug(`Total : ${events.length} events`)

        // processing
        const parsed = events.map(event => [event.args[0], event.args[1], (event.args[2]).toString()]) // sender, recipient, tokenId

        this.WALLETS = parsed.reduce((json, event) => {
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
        }, this.WALLETS)


    }

    async parseTransactionsErc1155(fromBlock, toBlock) {

        const transferBatchEvents = await this.assetContract.queryFilter(this.assetContract.filters.TransferBatch(null, null, null, null, null), fromBlock, toBlock);
        await delay(this.DELAY)
        const transferSingleEvents = await this.assetContract.queryFilter(this.assetContract.filters.TransferSingle(null, null, null, null, null), fromBlock, toBlock);

        this.logger.debug(`Total : ${transferBatchEvents.length + transferSingleEvents.length} events`)

        // processing
        const parsed1 = transferBatchEvents.map(event => [event.args[1], event.args[2], event.args[3], event.args[4]])
        const parsed2 = transferSingleEvents.map(event => [event.args[1], event.args[2], [event.args[3]], [event.args[4]]])

        this.WALLETS = (parsed1.concat(parsed2)).reduce((json, event) => {
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
        }, this.WALLETS)

    }

    getHolders() {
        // filter the holder who has no NFTs in their wallet
        return Object.keys(this.WALLETS).reduce((output, item) => {

            let itemCount = 0

            const ids = Object.keys(this.WALLETS[item])

            for (let id of ids) {
                if (this.WALLETS[item][id] > 0) {
                    itemCount += 1
                }
            }

            if (itemCount !== 0 && this.isNotBurnAddress(item)) {
                output.push(item)
            }

            return output
        }, [])
    }

    getRawHolders() {
        return this.WALLETS
    }

    isNotBurnAddress(address) {
        return (this.BURNT_ADDRESSES.map(item => item.toLowerCase()).indexOf(address.toLowerCase()) === -1)
    }

    printout(filename, content) {
        fs.writeFile(`${process.cwd()}/${filename}.txt`, content, { flag: 'w+' }, err => {
            if (err) {
                this.logger.error(`${err.message}`)
                return
            }
            //file written successfully
        })
    }

}

module.exports = {
    Holders
}
