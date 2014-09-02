var merge = require('node.extend'),
    cluster,
    socketId;


function onConnected (url, socket) {
  updateCluster(url, true, socket);
}

function onDisconnected (url, socket) {
  updateCluster(url, false, socket);

  setTimeout(function () {
    handlingPendingRequests(url, socket);
  }, 200);
}

function onHanging (url, socket) {
  handlingHangingConnection(url, socket);
}


function updateCluster (url, status, socket) {
  status = (typeof status === 'boolean' ? status : false);

  var index = socket.cluster.indexOf(url);

  if (status && index < 0) {
    // add host to cluster
    socket.cluster.push(url);
  }
  else if (!status && index > -1) {
    // remove host from cluster
    socket.cluster.splice(index, 1);
  }
}


function handlingPendingRequests (url, socket) {
  var queue = socket.getQueue(url),
      entry,
      data;
  console.log('pending requests: ', queue.length);

  while (queue.length) {
    entry = socket.connections[url]._outgoing.shift();
    data = socket.connections[url].parseQueueEntry(entry);

    this.send(data);
  }
}


function handlingHangingConnection (url, socket) {
  updateCluster(url, false);
  handlingPendingRequests(url);

  if (socket.getQueue(url).length) {
    console.log('##################################################');
    console.log('##################################################');
    console.log('################ QUEUE NOT EMPTY #################');
    console.log('##################################################');
    console.log('##################################################');
  }

  socket.close(url);

  delete socket.connections[url];

  socket.connect(url);
}



var clientTemplate = {
  connections: {},
  cluster: [],
};


function Client (_socket) {

  // Deep merge of the socket object and the client template
  merge(true, _socket, clientTemplate);

  _socket.on('connected', onConnected);
  _socket.on('disconnected', onDisconnected);
  _socket.on('hanging', onHanging);
}


module.exports = Client;
