const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("discord-ytdl-core");
const ytpl = require('ytpl');
const keepAlive = require('./server.js');
const config = require("./config.js");
const sounds = require("./sounds.js");

const isDev = process.argv.includes("--dev");

if (process.env['REPLIT']) {
  (async () => keepAlive())();
}

require('dotenv').config();

let token;

if (process.env['TOKEN_PROD']) {
  token = process.env['TOKEN_PROD'];
} else if (process.env['TOKEN_DEV']) {
  token = process.env['TOKEN_DEV'];
}

class Silence extends Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE])));
  }
}

class PhantasmBot {
  constructor() {
    this.prefix = "!ghost";
    this.autoJoinChannelName = "Castle";
    this.queue = new Map();
    this.emptyVideo = "https://www.youtube.com/watch?v=kvO_nHnvPtQ";
    this.sounds = sounds;
  }

  _connectToVoice(msg, isAutoJoin) {
    const channelID = msg.member.voice.channelID;
    const channel = client.channels.cache.get(channelID);

    if (!channelID) {
      return console.error("To invite me, join a voice chat first");
    }

    const permissions = channel.permissionsFor(msg.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return console.error("I need permissions to join this voice chat.");
    } else if (!channel) {
      return console.error("The channel does not exist!");
    } else {
      channel.join().then(connection => {
        this.connection = connection;
        this.connection.play(ytdl(this.emptyVideo,
        {
          filter: "audioonly",
          fmt: "mp3"
        }))
        console.log("Successfully connected.");

        if (isAutoJoin) {
          sound = _getRandomSound(this.sounds);

          this._play(msg.guild, sound);
        }

      }).catch(e => {
        console.error(e);
      });
    }

  }

  _disconnectFromVoice(msg) {
    if(msg.guild.me.voice.channel) {
      msg.guild.me.voice.channel.leave();
    }
  }

  _skip() {
    this.dispatcher.emit("finish");
  }

  _play(guild, song) {
    if (!song) {
      this.serverQueue.voiceChannel.leave();
      this.queue.delete(guild.id);
      return;
    }

    const stream = ytdl(song, {
      filter: "audioonly",
      fmt: "mp3"
    });

    if (this.serverQueue.connection) {
      this.dispatcher = this.connection
      .play(stream)
      .on("finish", () => {
          this.serverQueue.songs.shift();
          this._play(guild, this.serverQueue.songs[0]);
      })
      .on("error", error => console.error(error));
      
      this.dispatcher.setVolumeLogarithmic(this.serverQueue.volume / 5);
    } else {
      console.log("Connection is undefined.")
      this.serverQueue.voiceChannel.leave();
    }
  }

  _interceptPlayCommand(splitCommand, msg, shuffle) {
    let playlist = this.playlists[splitCommand[2]];

    if(!msg.guild.me.voice.channel) {
      return console.error("I am not in a channel.");
    } else if (playlist) {
      this._startPlaylist(msg, playlist, shuffle);
    }
  }

  _parseCommand(msg) {
    /*
    let content = msg.content.toLowerCase();
    const usage = `
    \`\`\`
Boo!
\`\`\`
    `
    const embed = new Discord.MessageEmbed()
    .setColor('#000000')
    .setDescription(usage)
    .setFooter('Author: Barretta', 'https://i.imgur.com/4Ff284Z.jpg');

    const splitCommand = content.split(" ");

    if (splitCommand[0].includes(this.prefix)) {
      switch (splitCommand[1]) {
        case "join":
        case "start": 
          this._connectToVoice(msg);
        break;
        case "skip":
          this._skip();
        break;
        case "stop":
          this._disconnectFromVoice(msg);
        break;
        case "play":
          this._interceptPlayCommand(splitCommand, msg);
        break;
        case "shuffle": 
          this._interceptPlayCommand(splitCommand, msg, true);
        break;
        case "help":
          msg.reply(embed);
        break;
      }
    }
    */
  }

  onMessage(msg) {
    if (!msg.author.bot) {
      this._parseCommand(msg);
    }
    
  }

}

const PhantasmBot = new PhantasmBot();

if (token) {
  
  if (isDev) {
    client.login(config.TOKEN_DEV);
  } else {
    client.login(config.TOKEN_PROD);
  }
 
  client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`)
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    const hasJoinedAutoJoinChannel = 
      newState.channel !== null && 
      newState.channel.name.includes(PhantasmBot.autoJoinChannelName);
    const notInAVoiceChannel = client.voice.connections.size <= 0;
    const isNotBot = !newState.member.user.bot;

    if (hasJoinedAutoJoinChannel && notInAVoiceChannel && isNotBot) {
      PhantasmBot._connectToVoice(newState, true);
    }
  });

  client.on('presenceUpdate', async (oldPresence, newPresence) => {
    console.log('New Presence:', newPresence)
  
    const member = newPresence.member
    const presence = newPresence
    const memberVoiceChannel = member.voice.channel
  
    if (!presence || !presence.activity || !presence.activity.name || !memberVoiceChannel) {
      return
    }
  
    const connection = await memberVoiceChannel.join()
  
    connection.on('speaking', (user, speaking) => {
      if (speaking) {
        console.log(`I'm listening to ${user.username}`)
      } else {
        console.log(`I stopped listening to ${user.username}`)
      }
    })
  })

  client.on("message", msg => PhantasmBot.onMessage(msg));
}


