# RipSize agent instructions

RipSize is a fresh Supernote plugin project. Do not restore or infer behavior from any earlier RipSize implementation unless a current issue or specification explicitly asks for it.

Before changing Supernote-specific code, read `.agents/skills/supernote-plugin-dev/SKILL.md` and the relevant file under `.agents/skills/supernote-plugin-dev/references/`.

Baseline runtime constraints:
- React Native: exactly 0.79.2
- React: exactly 19.0.0
- sn-plugin-lib: exactly 0.1.65 until deliberately upgraded and device-tested
- Android compile/target SDK: 35
- Android build-tools: 35.0.0
- NDK: 27.1.12297006

Supernote's live documentation is authoritative when it conflicts with vendored reference material. Keep the plugin ID stable after the first distributable build.
