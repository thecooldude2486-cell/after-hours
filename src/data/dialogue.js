import { VOICES } from "./voices.js";
// Story wording and the user-approved clarity revisions are documented in ADAPTATIONS.md.
const l = (speaker, text, duration = 4, audio = null) => ({
  speaker,
  text,
  duration,
  audio,
});
export const DIALOGUE = {
  voicemail: [l("MARA · VOICEMAIL", "Eli… you said you’d come back.", 7)],
  intercom: [l("MARA · INTERCOM", "You took a long time.", 4.5)],
  hideMemory: [
    l("MARA · CASSETTE", "Do you remember where we used to hide? I still leave things there.", 4.5),
  ],
  argument: [
    l("YOUNG MARA", "Can you walk home with me today?"),
    l("YOUNG ELI", "I've got things to do.", 3),
    l("YOUNG MARA", "It's nothing. I just don't like going that way alone.", 2.5),
    l("YOUNG ELI", "I've got to go, Mara. I'll meet you back home.", 4.5),
    l("", "", 3),
  ],
  teacher: [l("THE TEACHER", "The same excuse. Every morning.", 3), l("THE TEACHER", "We should have listened.", 3)],
  phone: [
    l("ELI", "Where are you?", 3),
    l("MARA · TELEPHONE", "Still here.", 4),
    l("ELI", "Are you hurt?", 3),
    l("", "", 5),
    l("MARA · TELEPHONE", "It was nothing. That's what I always said.", 4.5),
    l("ELI", "Mara… I'm sorry.", 5),
    l("MARA · TELEPHONE", "You didn't know. I made sure you didn't.", 5),
    l("", "", 4),
    l("MARA · TELEPHONE", "I wrote different words when nobody was looking.", 5),
    l("MARA · TELEPHONE", "The pages remember what I crossed out.", 6),
  ],
  abandonment: [
    l("YOUNG ELI", "You're not my responsibility.", 5),
    l("", "", 2),
  ],
  walkingAway: [
    l("MARA", "Eli?", 3),
    l("MARA", "Eli?", 3),
    l("MARA", "Please don't leave me.", 5),
  ],
  teacherReveal: [
    l("THE TEACHER", "Her pages reached the headmaster.", 4),
    l("THE TEACHER", "I went back. She was still inside.", 4),
  ],
  belief: [l("MARA · MEMORY", "He'll come back.", 5)],
  reunion: [
    l("ELI", "Mara… is it really you?", 4),
    l("MARA", "It’s me, Eli.", 3),
    l("ELI", "You’re really here.", 5),
    l("MARA", "You found the things I couldn't tell you.", 5),
  ],
  embrace: [l("MARA", "I knew you'd come back.", 6), l("", "", 4)],
  companion1: [
    l("MARA", "What's driving like?", 4),
    l("MARA", "Did Dad get grey hair?", 4),
    l("MARA", "Did anyone ask about the pages?", 4),
  ],
  companion2: [
    l("MARA", "I started the fire, Eli. I wanted them to burn with me.", 5),
    l("ELI", "I read the pages.", 4),
    l("MARA", "They found them first. They knew, and they left. I stayed inside.", 3),
    l("ELI", "What they did to you was wrong.", 2),
    l("", "", 2),
    l("ELI", "The fire was wrong too.", 5),
  ],
  entrance: [l("ELI", "Come on.", 4), l("ELI", "Mara?", 5)],
  return: [
    l("MARA", "No.", 3),
    l("MARA", "No, no, no. Go.", 5),
    l("ELI", "I already left you once.", 5),
    l("MARA", "You couldn't have known. I hid it from you.", 4),
    l("MARA", "You were a kid.", 4),
    l("ELI", "So were you.", 5),
    l("MARA", "The fire was my choice. I'm sorry, Eli.", 7),
  ],
  together: [
    l("MARA", "Are you staying?", 4),
    l("ELI", "No.", 3),
    l("ELI", "We're leaving together.", 6),
  ],
  classroom: [l("MARA", "Can we go now?", 5), l("ELI", "Yeah.", 5)],
  lastVoicemail: [
    l("MARA · VOICEMAIL", "[laughing]", 3),
    l("ELI · VOICEMAIL", "Come on, slowpoke.", 4),
    l("MARA · VOICEMAIL", "Wait for me!", 4),
    l("ELI · VOICEMAIL", "I am.", 5),
  ],
};

// Distance-triggered fragments of the abandonment memory.
DIALOGUE.walkaway1 = [DIALOGUE.walkingAway[0]];
DIALOGUE.walkaway2 = [DIALOGUE.walkingAway[1]];
DIALOGUE.walkaway3 = [DIALOGUE.walkingAway[2]];

for (const [group, lines] of Object.entries(DIALOGUE))
  for (let i = 0; i < lines.length; i++) {
    const clip = VOICES[group + ":" + i];
    if (clip && clip.text === lines[i].text) {
      lines[i].audio = clip.audio;
      lines[i].speechDuration = clip.duration;
      lines[i].voiceProfile =
        lines[i].speaker.includes("MARA") &&
        /INTERCOM|VOICEMAIL/.test(lines[i].speaker)
          ? "mara-device"
          : clip.character;
      lines[i].duration = Math.max(lines[i].duration, clip.duration);
    }
  }
