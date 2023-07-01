const ws = new WebSocket('ws://127.0.0.1:9000');

function $(a) {
  return document.getElementById(a);
}

function specialsIn(event) {
  let { message } = event;
  const moment = new Date(event.time);

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
  const event = JSON.parse(message.data);
  switch (event.type) {
    case 'message':
      var name = document.createElement('div');
      var icon = document.createElement('div');
      var body = document.createElement('div');
      var root = document.createElement('div');
      name.innerText = event.from;
      body.innerText = specialsIn(event);

      root.appendChild(name);
      root.appendChild(icon);
      root.appendChild(body);

      $('messages').appendChild(root);

      break;
    case 'authorize':
      if (event.success) {
        $('loginform').classList.remove('unauthorized');
      }
      break;
    default:
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
    ws.send(
      JSON.stringify({
        type: 'authorize',
        user: $('login').value,
        password: $('password').value,
      }),
    );
  }
};
$('input').onkeydown = function (e) {
  if (e.key === 13 && !e.ctrlKey && !e.shiftKey) {
    ws.send(
      JSON.stringify({
        type: 'message',
        message: specialsOut($('input').innerText),
      }),
    );
    $('input').innerText = '';
  }
};

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    const objDiv = $('messages');
    objDiv.scrollTop = objDiv.scrollHeight;
  });
}).observe($('messages'), { childList: true });
