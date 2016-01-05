/**
 * Module dependencies.
 */

var express = require('express')
  , app = express()  
  , fs = require('fs')
  , path = require('path')
  , spawn = require('child_process').spawn
  , omx = require('omxcontrol')
  , misc = require('misc')
  , pandora = require('pandora');

// Read private data
var passwords = require('./private')
// MAGIC HAPPENS HERE!
var opts = {
   
  // Specify the key file for the server
  key: fs.readFileSync('/home/pi/Authentication/server.key'),
   
  // Specify the certificate file
  cert: fs.readFileSync('/home/pi/Authentication/server.crt'),
   
  // Specify the Certificate Authority certificate
  ca: fs.readFileSync('/home/pi/Authentication/ca.crt'),
   
  // This is where the magic happens in Node.  All previous
  // steps simply setup SSL (except the CA).  By requesting
  // the client provide a certificate, we are essentially
  // authenticating the user.
  requestCert: true,
   
  // If specified as "true", no unauthenticated traffic
  // will make it to the route specified.
  rejectUnauthorized: true,

  // Passord
  passphrase: passwords.ssl_password
};

var server = require('https').createServer(opts, app)
  , io = require('socket.io').listen(server)


// all environments
app.set('port', process.env.TEST_PORT || 9000);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use(omx());
app.use(misc());
app.use(pandora());

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//Routes
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/public/index.html');
});

app.get('/remote', function (req, res) {
  res.sendfile(__dirname + '/public/main.html');
});

app.get('/main', function (req, res) {
  res.sendfile(__dirname + '/public/main.html');
});

app.get('/play/:video_id', function (req, res) {

});


//Socket.io Config
io.set('log level', 1);

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var ss;
var message;
var query;

//Run and pipe shell script output
function run_shell(cmd, args, cb, end) {
    var spawn = require('child_process').spawn,
        child = spawn(cmd, args),
        me = this;
    child.stdout.on('data', function (buffer) { cb(me, buffer); });
    child.stdout.on('end', end);
}

//Socket.io Server
io.sockets.on('connection', function (socket) {

 socket.on("screen", function(data){
   socket.type = "screen";
   ss = socket;
   console.log("Screen ready...");
 });
 socket.on("remote", function(data){
   socket.type = "remote";
   console.log("Remote ready...");
 });

 socket.on("controll", function(data){
	console.log(data);
   if(socket.type === "remote"){

     if(data.action === "tap"){
         if(ss != undefined){
            ss.emit("controlling", {action:"enter"});
            }
     }
     else if(data.action === "swipeLeft"){
      if(ss != undefined){
          ss.emit("controlling", {action:"goLeft"});
          }
     }
     else if(data.action === "swipeRight"){
       if(ss != undefined){
           ss.emit("controlling", {action:"goRight"});
           }
     }
   }
 });

 socket.on("video", function(data){

    if( data.action === "play"){
    var id = data.video_id;
    var url = "http://www.youtube.com/watch?v="+id;

    console.log("Command is youtube " + url);
    var runShell = new run_shell('youtube',[url],
        function (me, buffer) {
            me.stdout += buffer.toString();
            console.log(me.stdout);
            console.log(me.stderr);
            socket.emit("loading",{output: me.stdout});
         },
        function () {
            //child = spawn('omxplayer',[id+'.mp4']);
            //omx.start(id+'.mp4');
        });
    } else if ( data.action == "local"){
        var msg = unescape(data.video_id);
        if(msg == "Random") {
        console.log("command is playvideo -r -m " + query);
        var queryArray = query.split(' ');
        var runShell = new run_shell('playvideo',["-r","-m"].concat(queryArray),
            function (me, buffer) {
            me.stdout += buffer.toString();
            socket.emit("loading",{output: me.stdout});
            console.log(me.stdout);
         },
        function () {
        });
        } else {
        console.log("command is playdirect " + msg);
        var runShell = new run_shell('playdirect',[msg],
            function (me, buffer) {
            me.stdout += buffer.toString();
            socket.emit("loading",{output: me.stdout});
            console.log(me.stdout);
         },
        function () {
        });
        }
    } else if ( data.action == "getvideos"){
        query = data.query;
        console.log("Command is listvideo " + query);
        var runShell = new run_shell('listvideo',[query],
            function (me, buffer) {
            //me.stdout += buffer.toString();
            //console.log(me.stdout);
            message += buffer.toString();
         },
        function () {
            //child = spawn('omxplayer',[id+'.mp4']);
            //omx.start(id+'.mp4');
            console.log(message);
            socket.emit("loading",{output: message});
            message = "";
        });
    }
 });
});
