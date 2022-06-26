const { mainnet, polygon, bsc } = require("./angpow")
const { getAllProjects, getProject } = require("./projects")
const { getAllEvents, getEvent, generateProof, createEvent, _createEvent, register, getRegistered, updateEvent } = require("./events")
const { getAccount,  createAccountWithSigning } = require("./account")
const { getAllRewards, createReward } = require("./rewards")
const { getCollections, createCollection, getCollection } = require("./collections")
const { createCampaign, confirmCampaign, getAllCampaigns, getCampaign, updateCampaign, removeCampaign } = require("./campaigns")
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
    createReward,
    register,
    getRegistered,
    updateEvent,
    getCollections,
    getCollection,
    createCollection,
    createAccountWithSigning,
    proxy,
    createCampaign,
    confirmCampaign,
    getAllCampaigns,
    getCampaign,
    updateCampaign,
    removeCampaign
}