import { WebSocket } from 'ws';

import { MongoClient } from 'mongodb';
import { format } from 'util';

const wss = new WebSocket.Server({ port: 9000 });

let userListDB;
let chatDB;
const lpeers = [];
const peers = [];

MongoClient.connect('mongodb://127.0.0.1:27017', (err, db) => {
  if (err) {
    throw err;
  }

  userListDB = db.collection('users');
  chatDB = db.collection('chat');
});

function existUser(user, callback) {
  userListDB.find({ login: user }).toArray((error, list) => {
    callback(list.length !== 0);
  });
}
function checkUser(user, password, callback) {
  existUser(user, (exist) => {
    if (exist) {
      userListDB.find({ login: user }).toArray((error, list) => {
        callback(list.pop().password === password);
      });
    } else {
      userListDB.insert({ login: user, password }, { w: 1 }, (err) => {
        if (err) {
          throw err;
        }
      });
      callback(true);
    }
  });
}

function broadcast(by, message) {
  const time = new Date().getTime();
  peers.forEach((ws) => {
    ws.send(
      JSON.stringify({
        type: 'message',
        message,
        from: by,
        time,
      }),
    );
  });

  chatDB.insert({ message, from: by, time }, { w: 1 }, (err) => {
    if (err) {
      throw err;
    }
  });
}

function sendNewMessages(ws) {
  chatDB.find().toArray((error, entries) => {
    if (error) {
      throw error;
    }
    entries.forEach((entry) => {
      entry.type = 'message';
      ws.send(JSON.stringify(entry));
    });
  });
}

wss.on('connection', (ws) => {
  let login = '';
  let registered = false;

  ws.on('message', (message) => {
    const event = JSON.parse(message);
    if (event.type === 'authorize') {
      checkUser(event.user, event.password, (success) => {
        registered = success;

        const returning = { type: 'authorize', success };

        if (success) {
          returning.online = lpeers;
          lpeers.push(event.user);
          peers.push(ws);
          login = event.user;
          ws.on('close', () => {
            peers.exterminate(ws);
            lpeers.exterminate(login);
          });
        }
        ws.send(JSON.stringify(returning));
        if (success) {
          sendNewMessages(ws);
        }
      });
    } else {
      if (registered) {
        switch (event.type) {
          case 'message':
            broadcast(login, event.message);
            break;
          case 'type':
            // some icon
            break;
        }
      }
    }
  });
});

Array.prototype.exterminate = function (value) {
  this.splice(this.indexOf(value), 1);
};
