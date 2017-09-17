angular.module('GameApp', [])
   .controller('GameController', function ($scope, $timeout) {
      var getTextHeight = function (font) {

         var text = $('<span>Hg</span>').css({
            fontFamily: font
         });
         var block = $('<div style="display: inline-block; width: 1px; height: 0px;"></div>');

         var div = $('<div></div>');
         div.append(text, block);

         var body = $('body');
         body.append(div);

         try {

            var result = {};

            block.css({
               verticalAlign: 'baseline'
            });
            result.ascent = block.offset().top - text.offset().top;

            block.css({
               verticalAlign: 'bottom'
            });
            result.height = block.offset().top - text.offset().top;

            result.descent = result.height - result.ascent;

         }
         finally {
            div.remove();
         }

         return result;
      };

      // simple object used to store credentials for logging in to remote Nadron server.
      var config = {
         user: "user",
         pass: "pass",
         nick: "DemoUser",
         connectionKey: "LDGameRoom"
      };
      $scope.config = config;
      // connect to remote Nadron server.
      $scope.startGame = function () {
         nad.sessionFactory("ws://localhost:18090/nadsocket", config, sessionCreationCallback);
      }
      var messages = [];
      $scope.messages = messages;


      // Create the canvas
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext("2d");

      canvas.width = 512;
      canvas.height = 480;
      document.getElementById('gameCanvas').appendChild(canvas);
      var textHeight = getTextHeight("24px Helvetica").height;
      // Background image
      var bgReady = false;
      var bgImage = new Image();
      bgImage.onload = function () {
         bgReady = true;
      };
      bgImage.src = "images/background.png";

      // Hero image
      var heroReady = false;
      var heroImage = new Image();
      heroImage.onload = function () {
         heroReady = true;
      };
      heroImage.src = "images/hero.png";

      // Hero image
      var heroCompeterReady = false;
      var heroCompeterImage = new Image();
      heroCompeterImage.onload = function () {
         heroCompeterReady = true;
      };
      heroCompeterImage.src = "images/hero2.png";

      // Monster image
      var monsterReady = false;
      var monsterImage = new Image();
      monsterImage.onload = function () {
         monsterReady = true;
      };
      monsterImage.src = "images/monster.png";

      // Game objects
      var hero = {
         speed: 256 // movement in pixels per second
      };
      var monster = {};
      var monstersCaught = 0;

      // Handle keyboard controls
      var keysDown = {};

      addEventListener("keydown", function (e) {
         keysDown[e.keyCode] = true;
      }, false);

      addEventListener("keyup", function (e) {
         delete keysDown[e.keyCode];
      }, false);

      // Reset the game when the player catches a monster, invoked by server.
      var reset = function (otherPlayers, theMonster, curHero) {
         // if(curHero){
         //   hero.x = curHero.x;
         //   hero.y = curHero.y;
         // }
         monster = theMonster
            //  for (var k = 0; k < players.length; k++) {
            //     // players[k].entity.x = hero.x;
            //     // players[k].entity.y = hero.y;
            //     drawEntity(heroCompeterImage, players[k].entity);
            //  }
            //  ctx.drawImage(bgImage, 0, 0);
            //  drawEntity(heroImage, hero);
         drawEntity(monsterImage, monster);
      };

      // Update game objects
      var update = function (modifier, session) {
         if (null === myId) {
            console.log("Not yet initialized");
            return;
         }
         if (38 in keysDown) { // Player holding up
            hero.y -= hero.speed * modifier;
         }
         if (40 in keysDown) { // Player holding down
            hero.y += hero.speed * modifier;
         }
         if (37 in keysDown) { // Player holding left
            hero.x -= hero.speed * modifier;
         }
         if (39 in keysDown) { // Player holding right
            hero.x += hero.speed * modifier;
         }
         if (hero.x < 0) {
            hero.x = canvas.width;
         }
         if (hero.x > canvas.width) {
            hero.x = 0;
         }


         if (hero.y < 0) {
            hero.y = canvas.height;
         }
         if (hero.y > canvas.height) {
            hero.y = 0;
         }

         var message = {
            "hero": hero
         };
         // send new position to gameroom
         session.send(nad.NEvent(nad.NETWORK_MESSAGE, message));

      };

      var players = [];
      var myId = null;

      var logInfo = function (source, message) {
            $timeout(function () {
               messages.unshift({
                  source: source,
                  hero: source.hero,
                  text: message,
                  time:new Date().getTime()
               })
            })


         }
         // Draw everything
      var render = function (e) {
         var ldState = e.source;
         if (ldState.reset === true) {
            reset(ldState.entities, ldState.monster, ldState.hero);
            return;
         }

         switch (ldState.op) {
         case 'Disconnected':
            logInfo(e.source, "DisConnected");
            break;
         case 'LeftGame':
            logInfo(e.source, "Has Left Game");
            break;
         case 'Kill':
            logInfo(e.source, "Killed Moster at (" + e.source.monster.x + "," + e.source.monster.y + ")");
            break;
         case 'Connected':
            logInfo(e.source, "Connected");
            break;
         default:
            break;
         }


         // check if app is initalized.
         if (null === myId) {
            if (initHero(e) !== true) {
               return;
            }
         }
         var entities = ldState.entities;
         if ((null !== entities) && (typeof entities != 'undefined')) {
            players = [];
            for (var i = 0; i < entities.length; i++) {
               if ((null !== myId) && (entities[i].id === myId)) {
                  hero = entities[i];
                  monstersCaught = entities[i].score;
               }
               else {
                  players.push({
                     entity: entities[i],
                     id: entities[i].id
                  });
               }
            }
         }
         var theHero = ldState.hero;
         if ((null !== ldState.hero) && (typeof ldState.hero != 'undefined')) {
            if (myId === theHero.id) {
               hero = theHero;
               monstersCaught = theHero.score;
            }
            else {
               // update the competing hero's position on screen.
               for (var j = 0; j < players.length; j++) {
                  if (players[j].id === theHero.id) {
                     players[j].entity = theHero;
                  }
               }
            }
         }

         var theMonster = ldState.monster;
         if ((null !== theMonster) && (typeof theMonster != 'undefined')) {
            monster = theMonster;
         }

         if (bgReady) {
            ctx.drawImage(bgImage, 0, 0);
         }

         if (heroReady) {
            drawEntity(heroImage, hero);
         }

         if (monsterReady) {
            drawEntity(monsterImage, monster);
         }

         // load all other players
         if (heroCompeterReady) {
            for (var k = 0; k < players.length; k++) {
               drawEntity(heroCompeterImage, players[k].entity);
            }
         }


         // Score
         ctx.fillStyle = "rgb(250, 250, 250)";
         ctx.textAlign = "left";
         ctx.textBaseline = "top";
         ctx.font = "24px Helvetica";
         ctx.fillText("Goblins caught: " + monstersCaught, 32, 32);
      };

      function initHero(e) {
         var ldState = e.source;
         if ((null !== ldState.hero) && (typeof ldState.hero != 'undefined')) {
            hero = ldState.hero;
            monstersCaught = ldState.hero.score;
            myId = hero.id;
            return true;
         }
         else {
            console.log("Unable to initialize app");
            e.target.close(); // target is the session.
            return false;
         }
      }

      function drawEntity(img, entity) {
         if (entity.name) {
            var w = ctx.measureText(entity.name).width;
            ctx.fillText(entity.name, entity.x - w / 2 + 16, entity.y - textHeight - 5);
         }
         ctx.drawImage(img, entity.x, entity.y);
      }

      // The main game loop
      var main = function (session) {
         var now = Date.now();
         var delta = now - then;

         update((delta / 1000), session);
         //render(); // will be done from server now

         then = now;
      };

      var then;

      // This is the callback function that gets invoked
      // when session is connected to Nadron server.
      function sessionCreationCallback(session) {
         session.onmessage = render;
         // Send the java event class name for Jackson to work properly.
         session.send(nad.CNameEvent("io.nadron.example.lostdecade.LDEvent"));
         then = Date.now();
         setInterval(main.bind(null, session), 30); // Gives around 33 fps.
      }

   });
