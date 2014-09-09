var merge = require('node.extend'),
    util = require('util');


function onPortInUse (port, url, socket) {
  if (! util.isArray(socket.config.portRange)) {
    throw {
      name: 'ServerBindException',
      message: 'Port "' + socket.config.port + '" is already used:' +
      '\n   choose a new one or specify a port range such as "portRange: [20000, 20004]" allowing' +
      '\n   the service to be run multiple times to take advantage of multiple cores (clustering)\n\n'
    };
  }
  else {
    var portMax = socket.config.portRange[1],
        newPort = port + 1;

    if (newPort <= portMax) {
      socket.config.port = newPort;
      socket.bind(socket.requestHandler);
    }
    else {
      throw {
        name: 'ServerBindException',
        message: 'Port "' + newPort + '" exceeding port range "' + socket.config.portRange + '":' +
        ' increase the number of ports or decrease number of processes \n\n'
      };
    }
  }
}

function onListen (url, socket) {
  //console.log(arguments);
}

function onError (url, socket) {
  console.log(arguments);
}

var serverTemplate = {
};


function Server (_socket) {

  // Deep merge of the socket object and the client template
  merge(true, _socket, serverTemplate);

  _socket.on('error', onError);
  _socket.on('listen', onListen);
  _socket.on('portAlreadyInUse', onPortInUse);
}


module.exports = Server;
