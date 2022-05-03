
const Order = {
    version: 1,
    orderId : 1,
    timestamp : 1651313807,
    chainId: 42,
    confirmed : false,
    visible: false,
    canceled : false,
    fulfilled: false,
    crosschain: false,
    locked: false,
    ownerAddress: "0xaF00d9c1C7659d205e676f49Df51688C9f053740",
    baseAssetAddress: "0xaF00d9c1C7659d205e676f49Df51688C9f053740",
    baseAssetTokenId: 1,
    baseAssetIs1155: false,
    barterList: [
        {
            assetAddress: "0xaF00d9c1C7659d205e676f49Df51688C9f053740",
            assetTokenIdOrAmount: "1",
            tokenType: 1,
            chainIds : []
        }
    ]
}

module.exports = Order