const ws = new WebSocket('ws://x.cloudx.cx:9000');

function $(a) {
  return document.getElementById(a);
}

function specialsIn(event) {
  let { message } = event;
  const moment = new Date(event.time);

  // получаем время в пригодном виде
  let time = moment.getHours() < 10 ? `0${moment.getHours()}` : moment.getHours();
  time = moment.getMinutes() < 10
    ? `${time}:0${moment.getMinutes()}`
    : `${time}:${moment.getMinutes()}`;
  time = moment.getSeconds() < 10
    ? `${time}:0${moment.getSeconds()}`
    : `${time}:${moment.getSeconds()}`;
  let date = moment.getDate() < 10 ? `0${moment.getDate()}` : moment.getDate();
  date = moment.getMonth() < 10
    ? `${date}.0${moment.getMinutes()}.${moment.getFullYear()}`
    : `${date}:${moment.getMonth()}.${moment.getFullYear()}`;

  message = message.replace(/\[time\]/gim, time);
  message = message.replace(/\[date\]/gim, date);

  return message;
}

ws.onmessage = function (message) {
  // приводим ответ от сервера в пригодный вид
  const event = JSON.parse(message.data);

  // проверяем тип события и выбираем, что делать
  switch (event.type) {
    case 'message':
      // рендерим само сообщение

      const name = document.createElement('div');
      const icon = document.createElement('div');
      const body = document.createElement('div');
      const root = document.createElement('div');
      name.innerText = event.from;
      body.innerText = specialsIn(event);

      root.appendChild(name);
      root.appendChild(icon);
      root.appendChild(body);

      $('messages').appendChild(root);

      break;
    case 'authorize':
      // ответ на запрос об авторизации
      if (event.success) {
        $('loginform').classList.remove('unauthorized');
      }
      break;
    default:
      // если сервер спятил, то даем об себе этом знать
      console.log('unknown event:', event);
      break;
  }
};

function specialsOut(message) {
  message = message.replace(/\s*\/me\s/, `${$('login').value} `);

  return message;
}

$('password').onkeydown = function (e) {
  if (e.key === 13) {
    // отправляем серверу событие authorize
    ws.send(
      JSON.stringify({
        type: 'authorize',
        user: $('login').value,
        password: $('password').value,
      }),
    );
  }
};
// по нажатию Enter в поле ввода текста
$('input').onkeydown = function (e) {
  // если человек нажал Ctrl+Enter или Shift+Enter, то просто создаем новую строку.
  if (e.key === 13 && !e.ctrlKey && !e.shiftKey) {
    // отправляем серверу событие message
    ws.send(
      JSON.stringify({
        type: 'message',
        message: specialsOut($('input').innerText),
      }),
    );
    $('input').innerText = ''; // чистим поле ввода
  }
};
// скроллим вниз при новом сообщении
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    const objDiv = $('messages');
    objDiv.scrollTop = objDiv.scrollHeight;
  });
}).observe($('messages'), { childList: true });
