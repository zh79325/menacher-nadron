package io.nadron.example.lostdecade;

import io.nadron.app.GameRoom;
import io.nadron.app.PlayerSession;
import io.nadron.app.Session;
import io.nadron.app.impl.GameRoomSession;
import io.nadron.event.Event;
import io.nadron.event.Events;
import io.nadron.event.impl.DefaultEventContext;
import io.nadron.event.impl.DefaultSessionEventHandler;
import io.nadron.event.impl.SessionMessageHandler;
import io.nadron.service.GameStateManagerService;

import java.util.HashSet;
import java.util.Set;


/**
 * The onLogin method is overriden so that incoming player sessions can be
 * initialzied with event handlers to do user logic. In this scenario, the only
 * thing the handler does is to patch incoming messages to the GameRoom which in
 * turn has the game logic and state. In more real-world scenarios, the session
 * handler can have its own logic, for e.g. say validation to prevent cheating,
 * filtering, pre-processing of event etc.
 *
 * @author Abraham Menacherry
 */
public class LDRoom extends GameRoomSession {
    private static final int canvasWidth = 512;
    private static final int canvasHeight = 480;

    public LDRoom(GameRoomSessionBuilder builder) {
        super(builder);
        addHandler(new GameSessionHandler(this));
    }

    @Override
    public void onLogin(final PlayerSession playerSession) {
        // Add a session handler to player session. So that it can receive
        // events.
        playerSession.addHandler(new DefaultSessionEventHandler(playerSession) {
            @Override
            protected void onDataIn(Event event) {
                if (null != event.getSource()) {
                    // Pass the player session in the event context so that the
                    // game room knows which player session send the message.
                    event.setEventContext(new DefaultEventContext(
                            playerSession, null));
                    // pass the event to the game room
                    playerSession.getGameRoom().send(event);
                }
            }

            @Override
            protected void onDisconnect(Event event) {
                super.onDisconnect(event);
                Entity hero = createHero(playerSession);
                LDGameState newState=new LDGameState(null,
                        null, hero);
                newState.setOp(LDOpeartion.Disconnected);
                sendBroadcast(Events.networkEvent(newState));
            }
        });

        // Now add the hero to the set of entities managed by LDGameState
        Entity hero = createHero(playerSession);
        LDGameState state = (LDGameState) getStateManager().getState();
        state.getEntities().add(hero);
        // We do broadcast instead of send since all connected players need to
        // know about the new players arrival so that this hero can be drawn on
        // their screens.
        LDGameState newState=new LDGameState(state.getEntities(),
                state.getMonster(), hero);
        newState.setOp(LDOpeartion.Connected);
        sendBroadcast(Events.networkEvent(newState));
    }

    @Override
    public synchronized boolean disconnectSession(PlayerSession playerSession) {
        boolean r = super.disconnectSession(playerSession);
        LDGameState state = (LDGameState) getStateManager().getState();
        Entity hero = new Entity();
        hero.setId((String) playerSession.getId());
        Set<Entity> heros = state.getEntities();
        for (Entity entity : heros) {
            if (entity.getId().equals(hero.getId())) {
                hero = entity;
                break;
            }
        }

        heros.remove(hero);
        LDGameState newState=new LDGameState(heros,
                state.getMonster(), hero);
        newState.setOp(LDOpeartion.LeftGame);
        sendBroadcast(Events.networkEvent(newState));
        return r;
    }

    private Entity createHero(final PlayerSession playerSession) {
        Entity hero = new Entity();
        hero.setId((String) playerSession.getId());
        hero.score = 0;
        hero.setType(Entity.HERO);
        hero.setY(canvasHeight / 2);
        hero.setX(canvasWidth / 2);
        hero.setSpeed(256);// speed in pixels per second
        hero.setName(playerSession.getPlayer().getName());
        return hero;
    }

    private static Entity createMonster() {
        Entity monster = new Entity();
        monster.setType(Entity.MONSTER);
        monster.setX(getRandomPos(canvasWidth));
        monster.setY(getRandomPos(canvasHeight));
        return monster;
    }

    private static int getRandomPos(int axisVal) {
        long round = Math.round(32 + (Math.random() * (axisVal - 64)));
        return (int) round;
    }

    /**
     * This handler is attached to the GameRoom and all game related logic is
     * embedded in it. Its a SESSION_MESSAGE handler and does not take care of
     * other events which are sent to the room.
     *
     * @author Abraham Menacherry
     */
    public static class GameSessionHandler extends SessionMessageHandler {
        Entity monster;
        GameRoom room;// not really required. It can be accessed as getSession()
        // also.

        public GameSessionHandler(GameRoomSession session) {
            super(session);
            this.room = session;
            GameStateManagerService manager = room.getStateManager();
            LDGameState state = (LDGameState) manager.getState();
            // Initialize the room state.
            state = new LDGameState();
            state.setEntities(new HashSet<Entity>());
            state.setMonster(createMonster());
            manager.setState(state); // set it back on the room
            this.monster = state.getMonster();
        }

        public void onEvent(Event event) {
            Entity hero = ((LDGameState) event.getSource()).getHero();
            Session session = event.getEventContext().getSession();
            update(hero, session);
        }

        private void update(Entity hero, Session session) {
            boolean isTouching = isTouch(hero,monster);

            LDGameState state = (LDGameState) room.getStateManager().getState();
            hero.setId((String) session.getId());
            if (isTouching) {
                hero.score += 1;
                state.addEntitiy(hero);
                reset();
            } else {
                state.addEntitiy(hero);
            }

            // The state of only one hero is updated, no need to send every
            // hero's state.
            // A possible optimization here is not to broadcast state in case
            // the hero has not moved.
            LDGameState newState=new LDGameState(state.getEntities(),
                    monster, hero);
            if(isTouching){
                newState.setOp(LDOpeartion.Kill);
            }
            room.sendBroadcast(Events.networkEvent(newState));
        }

        private boolean isTouch(Entity hero, Entity monster) {
            return (hero.getX() <= monster.getX() + 32)
                    && (hero.getY() <= monster.getY() + 32)
                    && (monster.getX() <= hero.getX() + 32)
                    && (monster.getY() <= hero.getY() + 32);
        }

        /**
         * When the hero and monster are touching each other it means hero
         * caught the monster, the game board needs to be reset. This method
         * will put the monster in a random position and all the heroes at the
         * center of the board. Also, it will send reset flag as
         * <code>true</code> to clients so that they can reset their own
         * screens.
         */
        private void reset() {
            Set<Entity> entities = ((LDGameState) room.getStateManager()
                    .getState()).getEntities();
//            for (Entity entity : entities) {
//                entity.setY(canvasHeight / 2);
//                entity.setX(canvasWidth / 2);
//            }
            boolean touch=true;
            while (touch){
                monster.setX(getRandomPos(canvasWidth));
                monster.setY(getRandomPos(canvasHeight));
                for (Entity entity : entities) {
                    touch = isTouch(entity,monster);
                    if(touch){
                        break;
                    }
                }
            }

            // no need to send the entities here since client will do resetting on its own.
            LDGameState ldGameState = new LDGameState(entities, monster, null);
            ldGameState.setReset(true);
            room.sendBroadcast(Events.networkEvent(ldGameState));
        }

    }
}
