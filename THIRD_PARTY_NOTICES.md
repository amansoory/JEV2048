# Third-party algorithms and assets

- **TDL2048+**, Hung Guei, https://github.com/moporgic/TDL2048, frozen commit `a99f620aec0d30a75943a4c9646743f1f53b0197`. MIT license reproduced in `public/licenses/TDL2048-MIT.txt` and `deploy/ntuple/TDL2048/LICENSE.md`. The original source and pretrained 4×6 values are unchanged. This project supplies a native protocol adapter and HTTP service. Checkpoint URL, format, locally verified checksums and source manifest are included in `deploy/ntuple/`.
- **2048-ai**, Robert Xiao and contributors, https://github.com/nneonneo/2048-ai. Adapted JavaScript expectimax work is documented in `SEARCH-SOLVER.md`; its MIT license is in `public/licenses/nneonneo-MIT.txt`. The implementation is search, not a trained model. Do not attribute Jev integration to this upstream project.
- **2048**, Gabriele Cirulli, original rules/reference source used by the engine checks. Existing original license and attribution are preserved in the repository.
- **TypeSafe Jev**, https://typesafe.ai. Hosted classifier accessed with the TypeSafe SDK. No Jev weights are distributed here.
- **DM Sans**, bundled through `@fontsource-variable/dm-sans` under its accompanying SIL Open Font License; Next.js serves the font locally.

Other dependencies retain their licenses in their packages. The pretrained checkpoint is downloaded from the author's official endpoint during the controlled service image build; it is not committed to this repository.
