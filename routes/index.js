const { mainnet, polygon, bsc } = require("./angpow")
const { getAllProjects, getProject } = require("./projects")
const { getAllEvents, getEvent, generateProof, createEvent, register, getRegistered } = require("./events")
const { getAccount, createAccount } = require("./account")
const { getAllRewards } = require("./rewards")
const { getAllOrders, createOrder, getOrder, confirmOrder, cancelOrder } = require("./orders")
const { getCollections } = require("./collections")
const { headers } = require("./headers")

module.exports = {
    mainnet,
    polygon,
    bsc,
    headers,
    getAllProjects,
    getProject,
    getAllEvents,
    getEvent,
    generateProof,
    getAccount,
    createAccount,
    createEvent,
    getAllRewards,
    register,
    getRegistered,
    getAllOrders,
    createOrder,
    getOrder,
    confirmOrder,
    cancelOrder,
    getCollections
}