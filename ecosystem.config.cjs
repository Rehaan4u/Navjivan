module.exports = {
  apps: [{
    name: "navjivan",
    script: "dist/index.js",
    env: {
      NODE_ENV: "production",
      PORT: 5001
    }
  }]
}
