import { WebSocket } from 'ws';

// соединение с БД
import { MongoClient } from 'mongodb';
import { format } from 'util';

const wss = new WebSocket.Server({ port: 9000 });

let userListDB;
let chatDB;
const lpeers = [];
const peers = [];

// подсоединяемся к БД
MongoClient.connect('mongodb://127.0.0.1:27017', (err, db) => {
  if (err) {
    throw err;
  }

  // записываем ссылки на таблицы (коллекции) в глобальные переменные
  userListDB = db.collection('users');
  chatDB = db.collection('chat');
});

// проверка пользователя на предмет существования в базе данных
function existUser(user, callback) {
  userListDB.find({ login: user }).toArray((error, list) => {
    callback(list.length !== 0);
  });
}
// эта функция отвечает целиком за всю систему аккаунтов
function checkUser(user, password, callback) {
  // проверяем, есть ли такой пользователь
  existUser(user, (exist) => {
    // если пользователь существует
    if (exist) {
      // то найдем в БД записи о нем
      userListDB.find({ login: user }).toArray((error, list) => {
        // проверяем пароль
        callback(list.pop().password === password);
      });
    } else {
      // если пользователя нет, то регистрируем его
      userListDB.insert({ login: user, password }, { w: 1 }, (err) => {
        if (err) {
          throw err;
        }
      });
      // не запрашиваем авторизацию, пускаем сразу
      callback(true);
    }
  });
}

function broadcast(by, message) {
  // запишем в переменную, чтоб не расходилось время
  const time = new Date().getTime();

  // отправляем по каждому соединению
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

  // сохраняем сообщение в истории
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

// при новом соединении
wss.on('connection', (ws) => {
  // проинициализируем переменные
  let login = '';
  let registered = false;

  // при входящем сообщении
  ws.on('message', (message) => {
    // получаем событие в пригодном виде
    const event = JSON.parse(message);

    // если человек хочет авторизироваться, проверим его данные
    if (event.type === 'authorize') {
      // проверяем данные
      checkUser(event.user, event.password, (success) => {
        // чтоб было видно в другой области видимости
        registered = success;

        // подготовка ответного события
        const returning = { type: 'authorize', success };

        // если успех, то
        if (success) {
          // добавим к ответному событию список людей онлайн
          returning.online = lpeers;

          // добавим самого человека в список людей онлайн
          lpeers.push(event.user);

          // добавим ссылку на сокет в список соединений
          peers.push(ws);

          // чтобы было видно в другой области видимости
          login = event.user;

          //  если человек вышел
          ws.on('close', () => {
            peers.exterminate(ws);
            lpeers.exterminate(login);
          });
        }

        // ну и, наконец, отправим ответ
        ws.send(JSON.stringify(returning));

        // отправим старые сообщения новому участнику
        if (success) {
          sendNewMessages(ws);
        }
      });
    } else {
      // если человек не авторизирован, то игнорим его
      if (registered) {
        // проверяем тип события
        switch (event.type) {
          // если просто сообщение
          case 'message':
            // рассылаем его всем
            broadcast(login, event.message);
            break;
          // если сообщение о том, что он печатает сообщение
          case 'type':
            // то пока я не решил, что делать в таких ситуациях
            break;
        }
      }
    }
  });
});

Array.prototype.exterminate = function (value) {
  this.splice(this.indexOf(value), 1);
};
