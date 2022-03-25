const fs = require("fs");

const apps = [];
fs.readdirSync("./projects/").map((project, index) =>
  apps.push({
    name: String(project),
    script: "./services/fetch-holders/index.js",
    args: String(project),
    instances: 1,
    cron_restart: `${Math.floor(index / 10)} ${index % 10} * * *`
  })
);
console.log(apps);

module.exports = {
  apps,
};
