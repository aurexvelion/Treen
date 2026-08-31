# T.R.E.E.N.

Standalone Android training app.

**T.R.E.E.N. = Training Routine • Endurance • Exercise Navigator**

Features:
- Monday–Friday outdoor training plan
- guided workout mode
- session and exercise timers
- walk/jog interval progression
- calf/pain safety mode
- weekly overview
- workout history, minutes and streak
- offline local storage

This is a standalone app. It does not import, share storage with, or depend on L.U.N.A.R.

## Run

```bash
npm install
npx expo start
```

## APK

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Android package id: `com.treen.training`
