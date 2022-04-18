const { mainnet , polygon, bsc } = require("./angpow")
const { getAllProjects, getProject } = require("./projects")
const { getAllEvents, getEvent, generateProof, createEvent } = require("./events")
const { getAccount, createAccount } = require("./account")

const headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
}

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
    createEvent
}