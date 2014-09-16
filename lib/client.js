var merge = require('node.extend'),
    pool,                        // socket connection pool
    socketId;

    /*
      ██╗  ██╗ █████╗ ███╗   ██╗██████╗ ██╗     ███████╗██████╗ ███████╗
      ██║  ██║██╔══██╗████╗  ██║██╔══██╗██║     ██╔════╝██╔══██╗██╔════╝
      ███████║███████║██╔██╗ ██║██║  ██║██║     █████╗  ██████╔╝███████╗
      ██╔══██║██╔══██║██║╚██╗██║██║  ██║██║     ██╔══╝  ██╔══██╗╚════██║
      ██║  ██║██║  ██║██║ ╚████║██████╔╝███████╗███████╗██║  ██║███████║
      ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝
    */

/**
 * Handles pool changes on connection:
 * - the new connection is added to the connection pool
 *
 * @param url {String} connection's url
 * @param socket {Object} socket object
 */
function onConnected (url, socket) {
  updatePool(url, socket, true);
}

/**
 * Handles pool changes on disconnection:
 * - connection status is updated
 * - the connection is removed from the pool
 * - pending messages are handled
 *
 * @param url {String} connection's url
 * @param socket {Object} socket object
 */
function onDisconnected (url, socket) {
  updatePool(url, socket, false);

  setTimeout(function () {
    handlePendingMessages(url, socket);
  }, 200);
}

/**
 * Handles hanging connections:
 * - the connection is removed from the pool
 * - pending messages are handled
 * - close connection
 * - reopen connection
 *
 * @param url {String} connection's url
 * @param socket {Object} socket object
 */
function onHanging (url, socket) {
  handlingHangingConnection(url, socket);
}

/**
 * Updates the connection pool of the socket
 *
 * @param url {String} connection's url
 * @param socket {Object} socket object
 * @param status {Boolean} active/inactive status
 */
function updatePool (url, socket, status) {
  status = (typeof status === 'boolean' ? status : false);
  
  var index = socket.pool.indexOf(url);

  if (status && index < 0) {
    // add host to pool
    socket.pool.push(url);
  }
  else if (!status && index > -1) {
    // remove host from pool
    socket.pool.splice(index, 1);
  }
}



/**
 * Handles the pending messages form a given connection
 *
 * @param url {String} connection's url
 * @param socket {Object} socket object
 */
function handlePendingMessages (url, socket) {
  var queue = socket.getQueue(url),
      entry,
      data;
  console.log('pending requests: ', queue.length);

  while (queue.length) {
    entry = queue.shift();
    data = socket.parseQueueEntry(entry);

    socket.send(data);
  }
}


function handlingHangingConnection (url, socket) {
  updatePool(url, socket, false);
  handlePendingMessages(url, socket);

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

    /*
      ████████╗███████╗███╗   ███╗██████╗ ██╗      █████╗ ████████╗███████╗
      ╚══██╔══╝██╔════╝████╗ ████║██╔══██╗██║     ██╔══██╗╚══██╔══╝██╔════╝
         ██║   █████╗  ██╔████╔██║██████╔╝██║     ███████║   ██║   █████╗  
         ██║   ██╔══╝  ██║╚██╔╝██║██╔═══╝ ██║     ██╔══██║   ██║   ██╔══╝  
         ██║   ███████╗██║ ╚═╝ ██║██║     ███████╗██║  ██║   ██║   ███████╗
         ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
    */


var clientTemplate = {

  // one "client" socket may be connected to multiple hosts
  // Object holding all connections referenced by connection url (unique)
  connections: {},

  // Array holding all active connection urls
  pool: [],

  startTime: 0,

  requestCount: 0,
  
  throughput: 0,
  
  initStats: function (url) {
    this.connections[url].url = url;
    this.connections[url].parent = this;

    this.connections[url].stats = {};
    this.connections[url].stats.startTime = Date.now();
    this.connections[url].stats.requestCount = 0;
    this.connections[url].stats.throughputAvg = 0;
    this.connections[url].stats.hangingCycles = 0;
  },

  updateStats: function (url, data) {
    var now = Date.now();

    this.requestCount += 1;
    var socketUptime = now - this.startTime;
    this.throughput = this.requestCount / socketUptime;
    
    this.connections[url].stats.requestCount += 1;

    var uptime = now - this.connections[url].stats.startTime,
        pendingRate = (this.connections[url].stats.requestCount + this.getQueue(url).length * 10 ) / uptime,
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

      console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
      console.log('socket requestCount: ', this.requestCount);
      console.log('socket throughput: ', this.throughput);
      console.log('connection stats: ', this.connections[url].stats);
      console.log('connection hanging ('+this.connections[url].stats.pendingOverflow+' && '+this.connections[url].stats.pendingOverflowGrowing+' && '+this.connections[url].stats.hangingCycles+' > '+this.connections[url].stats.maxHangingCycles+'): ', (this.connections[url].stats.pendingOverflow && this.connections[url].stats.pendingOverflowGrowing && this.connections[url].stats.hangingCycles > this.connections[url].stats.maxHangingCycles));
      
    if (this.connections[url].stats.pendingOverflow && this.connections[url].stats.pendingOverflowGrowing && this.connections[url].stats.hangingCycles > this.connections[url].stats.maxHangingCycles) {
      console.log('!!!!! HANGING CONNECTION !!!!!!!!!!!!!!!!!!!!!');
      this.emit('hanging', url, this);
    }
  }
};


    /*
      ███╗   ███╗██╗██╗  ██╗██╗███╗   ██╗
      ████╗ ████║██║╚██╗██╔╝██║████╗  ██║
      ██╔████╔██║██║ ╚███╔╝ ██║██╔██╗ ██║
      ██║╚██╔╝██║██║ ██╔██╗ ██║██║╚██╗██║
      ██║ ╚═╝ ██║██║██╔╝ ██╗██║██║ ╚████║
      ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
    */

function Client (_socket) {

  // Deep merge of the socket object and the client template
  merge(true, _socket, clientTemplate);
  
  _socket.startTime = Date.now();

  _socket.on('connected', onConnected);
  _socket.on('disconnected', onDisconnected);
  _socket.on('hanging', onHanging);
}


module.exports = Client;
