const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("discord-ytdl-core");
const keepAlive = require('./server.js');
const config = require("./config.js");
const sounds = require("./sounds.js");
var stream = require('stream');

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

class Silence extends stream.Readable {
  _read() {
    this.push(Buffer.from([0xF8, 0xFF, 0xFE]));
  }
}

class PhantasmBot {
  constructor() {
    this.prefix = "!pha";
    this.autoJoinChannelName = "Castle";
    this.queue = new Map();
    this.emptyVideo = "https://www.youtube.com/watch?v=kvO_nHnvPtQ";
    this.sounds = sounds;
    this.isNotPlaying = true;
  }

  _getRandomSound() {
    let randomSound;

    if (this.sounds.length) {
      const index = Math.floor(Math.random() * this.sounds.length);

      randomSound = this.sounds[index];
    } else {
      randomSound = this.emptyVideo;
    }

    return randomSound;
  }

  _debounce(func, timeout = 7000) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(
        () => { func.apply(this, args); }, timeout
      );
    };
  }

  _handleUserSpeaking(user, speaking) {
    if (speaking.bitfield) {
      console.log(`I'm listening to ${user.username}`)
    } else {
      console.log(`I stopped listening to ${user.username}`)

      if (this.isNotPlaying) {
        this.isNotPlaying = false;

        const dbPlay = this._debounce(
          () => {
            const sound = this._getRandomSound();
  
            this._play(this.msg.guild, sound);
          }
        );
  
        dbPlay();
      }
    }
  }

  _connectToVoice(msg, isAutoJoin) {
    const channelID = msg.member.voice.channelID;
    const channel = client.channels.cache.get(channelID);

    this.msg = msg;

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

        connection.on(
          'speaking', (user, speaking) => this._handleUserSpeaking(user, speaking)
        );

        connection.on(
          'disconnected', () => {
            this.isNotPlaying = true
          } 
        )

        this.connection.play(ytdl(this.emptyVideo,
        {
          filter: "audioonly",
          fmt: "mp3"
        }))

        console.log("Successfully connected.");

        const sound = this._getRandomSound();
        this._play(msg.guild, sound);
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

  _play(guild, sound) {
    if (!sound) {
      this.serverQueue.voiceChannel.leave();
      this.queue.delete(guild.id);
      return;
    }

    const stream = ytdl(sound, {
      filter: "audioonly",
      fmt: "mp3"
    });

    if (this.connection) {
      this.dispatcher = this.connection
      .play(stream)
      .on("finish", () => {
        this.isNotPlaying = true;
      })
      .on("error", error => console.error(error));
      
      this.dispatcher.setVolumeLogarithmic(1);
    } else {
      console.log("Connection is undefined.")
      this.serverQueue.voiceChannel.leave();
    }
  }
  
  /*
  _interceptPlayCommand(splitCommand, msg, shuffle) {
    let playlist = this.playlists[splitCommand[2]];

    if(!msg.guild.me.voice.channel) {
      return console.error("I am not in a channel.");
    } else if (playlist) {
      this._startPlaylist(msg, playlist, shuffle);
    }
  }
  */

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

const phantasmBot = new PhantasmBot();

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
      newState.channel.name.includes(phantasmBot.autoJoinChannelName);
    const notInAVoiceChannel = client.voice.connections.size <= 0;
    const isNotBot = !newState.member.user.bot;

    if (hasJoinedAutoJoinChannel && notInAVoiceChannel && isNotBot) {
      phantasmBot._connectToVoice(newState, true);
    }
  });

  client.on("message", msg => phantasmBot.onMessage(msg));
}


