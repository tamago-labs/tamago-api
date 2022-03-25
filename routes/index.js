const { mainnet , polygon, bsc } = require("./angpow")
const { getAllProjects, getProject } = require("./projects")
const { getAllEvents } = require("./events")


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
    getAllEvents
}