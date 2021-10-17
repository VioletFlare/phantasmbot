const Discord = require("discord.js");
const client = new Discord.Client();
const ytdl = require("discord-ytdl-core");
const keepAlive = require('./server.js');
const config = require("./config.js");
const sounds = require("./sounds.js");
var Readable = require('stream').Readable;

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

  _debounce(func, timeout = 2000) {
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

  _setConnectionEvents() {
    this.connection.on(
      'speaking', (user, speaking) => this._handleUserSpeaking(user, speaking)
    );

    this.connection.on(
      'disconnected', () => {
        this.isNotPlaying = true
      } 
    )
  }

  _patchVoiceBugWithEmptyFramePlay() {
    const emptyFrame = new Silence();
    this.connection.play(emptyFrame);
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
        this._setConnectionEvents();
        this._patchVoiceBugWithEmptyFramePlay();
        console.log("Successfully connected.");
        const sound = this._getRandomSound();
        this._play(msg.guild, sound);
      }).catch(e => {
        this.isNotPlaying = true;
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

  _bufferToReadableStream(buffer) {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    
    return stream;
  }

  _play(guild, sound) {
    if (!sound) {
      this.serverQueue.voiceChannel.leave();
      this.queue.delete(guild.id);
      return;
    }
    
    let stream;
    const buffer = Object.values(sound)[0];
    stream = this._bufferToReadableStream(buffer);

    if (this.connection && stream) {
      this.dispatcher = this.connection
      .play(stream)
      .on("finish", () => {
        this.isNotPlaying = true;
      })
      .on("error", error => console.error(error));
      
      this.dispatcher.setVolumeLogarithmic(1);
    } else {
      console.log("Connection is undefined.")
    }
  }

  _parseCommand(msg) {

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


