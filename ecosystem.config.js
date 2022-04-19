//IMPORTANT
// In case of maintenance or discontinuation of usage, `pm2 stop all` would termainate all pm2 jobs but they will restart again at the time specified by'cron_restart'parameter.  Use `pm2 delete all` to terminate and kill all the processes instead. 


const fs = require("fs");

const cron_minute = (int) => int % 2 === 0 ? 0 : 30
const cron_hour = (int) => Math.floor(int / 2)

const apps = [];
fs.readdirSync("./projects/").map((project, index) =>
  apps.push({
    name: String(project),
    script: "./services/fetch-holders/index.js",
    args: String(project),
    instances: 1,
    cron_restart: `${cron_minute(index)} ${cron_hour(index)} * * *`,
    // cron_restart: '*/1 * * * *', //this restarts the job every minute and it is intended for testing-purposes and should be turned-off by default
    autorestart: false //if set to 'true'(default value for this key) then the job would restart at every successful or errorful exit and causes infinite restart loop, the value for this key-pair must be kept as 'false'.  
  })
);
console.log(apps);

module.exports = {
  apps,
};
