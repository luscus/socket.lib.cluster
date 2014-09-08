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

  initStats: function (url) {
    this.connections[url].url = url;
    this.connections[url].parent = this;

    this.connections[url].stats = {};
    this.connections[url].stats.startTime = new Date().getTime();
    this.connections[url].stats.requestCount = 0;
    this.connections[url].stats.throughputAvg = 0;
    this.connections[url].stats.hangingCycles = 0;
  },

  updateStats: function (url, data) {
    var now = new Date().getTime();

    this.connections[url].stats.requestCount += 1;

    var uptime = now - this.connections[url].stats.startTime,
        pendingRate = (this.connections[url].stats.requestCount + this.connections[url]._outgoing.length * 10 ) / uptime,
        throughput = this.connections[url].stats.requestCount / uptime;

    if (! this.connections[url].stats.throughputAvg) this.connections[url].stats.throughputAvg = throughput;

    this.connections[url].stats.throughputAvg = (this.connections[url].stats.throughputAvg + throughput) / 2;

    this.connections[url].stats.pendingOverflow = (pendingRate > this.connections[url].stats.throughputAvg * 2);

    if (this.connections[url].stats.pendingOverflow) {
      this.connections[url].stats.hangingCycles += 1;
      if (!this.connections[url].stats.maxHangingCycles) this.connections[url].stats.maxHangingCycles = this.connections[url]._outgoing.length + 10;
      this.connections[url].stats.pendingOverflowGrowing = this.connections[url].stats.oldpendingRate <= pendingRate;
      this.connections[url].stats.oldpendingRate = pendingRate;
    }
    else {
      this.connections[url].stats.hangingCycles = 0;
      this.connections[url].stats.maxHangingCycles = 0;
      this.connections[url].stats.oldpendingRate = 0;
      this.connections[url].stats.pendingOverflowGrowing = false;
    }

    this.connections[url].stats.lastRequest = data;

    if (this.connections[url].pendingOverflow && this.connections[url].pendingOverflowGrowing && this.connections[url].hangingCycles > this.connections[url].maxHangingCycles) {
      this.emit('hanging', url, this.parent);
    }
  }
};


function Client (_socket) {

  // Deep merge of the socket object and the client template
  merge(true, _socket, clientTemplate);

  _socket.on('connected', onConnected);
  _socket.on('disconnected', onDisconnected);
  _socket.on('hanging', onHanging);
}


module.exports = Client;
