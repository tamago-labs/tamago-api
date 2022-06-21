const { mainnet, polygon, bsc } = require("./angpow")
const { getAllProjects, getProject } = require("./projects")
const { getAllEvents, getEvent, generateProof, createEvent, _createEvent, register, getRegistered, updateEvent } = require("./events")
const { getAccount,  createAccountWithSigning } = require("./account")
const { getAllRewards } = require("./rewards")
const { getCollections } = require("./collections")
const { proxy } = require("./utils")
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
    createEvent,
    _createEvent,
    getAllRewards,
    register,
    getRegistered,
    updateEvent,
    getCollections,
    createAccountWithSigning,
    proxy
}