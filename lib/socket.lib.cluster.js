var Client = require('./client'),
    Server = require('./server');


module.exports = function (_socket) {

  switch (_socket.config.side) {
    case 'client':
      Client(_socket);
      break;

    case 'server':
      Server(_socket);
      break;
  }
};
