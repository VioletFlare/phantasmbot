var fs = require('fs');

module.exports = [
    {   humming: fs.readFileSync('./sounds/humming.mp3')  },
    {   ghost_damaged: fs.readFileSync('./sounds/ghost_damaged.mp3')    },
    {   ghost_light_attack: fs.readFileSync('./sounds/ghost_light_attack.mp3')  },
    {   chains_rattle: fs.readFileSync('./sounds/chains_rattle.mp3')    },
    {   piano: fs.readFileSync('./sounds/piano.mp3')    }
];