# Guided practice — November 3, 2026

Choose **PRACTICE · LEARN THE CONTROLS** in the main menu. It uses your selected team and guides you through five drills:

1. Cycle the pass marker and complete a pass to #7.
2. Charge and release a shot past a real goalkeeper.
3. Move into range, face the carrier and land a knuckle hit.
4. Use a defender's longer-reaching chain against the carrier.
5. Block an incoming punch, release the guard and win the short restart fight. The teaching opponent leaves longer gaps between punches.

Each drill offers Retry and Exit at any time. Next unlocks after the actual objective succeeds; there is no automatic advance while controls are held. Completing the final drill offers Play the AI. Misses, saves, wrong receivers, out-of-play balls, lost fights and expired bomb timers provide retry guidance. Pause and focus-loss behavior also apply in practice. Retry creates a fresh scenario and clears input counters.

The practice controller arranges players and limits opponent behavior, then runs the normal simulation, including accuracy, catches, goalkeeper saves, attack ranges, fouls, bomb deaths and restart fights and directional blocking. Normal matches do not use the practice intent filter. Practice gives no Rapture Credits and does not submit match claims. The shared payout function also rejects practice rewards.

Validation: `npm test` includes the existing static/mobile and match tests plus practice tests for all five drills on either team, wrong-receiver rejection, success pausing, lost restart fights, expiration recovery and zero rewards. Browser checks exercised desktop, portrait touch and landscape touch, including actual passing/shooting controls, retry, pause, all-drill navigation, completion into a match and exit. Physical controller hardware remains untested.

Local implementation only. No deployment or publication; the existing publication hold remains in force.
