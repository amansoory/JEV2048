FROM python:3.12.8-slim-bookworm@sha256:2199a62885a12290dc9c5be3ca0681d367576ab7bf037da120e564723292a2f0 AS build
# Fixed Debian snapshot pins compiler and transitive package versions.
RUN rm /etc/apt/sources.list.d/debian.sources && printf 'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20250115T000000Z bookworm main\n' > /etc/apt/sources.list && apt-get update && apt-get install -y --no-install-recommends g++ make && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/ntuple
COPY TDL2048 ./TDL2048
COPY native ./native
COPY provenance.json model_setup.py ./
RUN g++ -std=c++20 -O3 -mtune=generic -pthread -Wall -o native/ntuple-bridge native/ntuple-bridge.cpp && g++ --version > compiler-version.txt
RUN python model_setup.py
COPY source-manifest.json verify_source.py ./
RUN python verify_source.py
FROM python@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254
RUN useradd --uid 1000 --create-home app
WORKDIR /opt/ntuple
COPY --from=build --chown=1000:1000 /opt/ntuple/native/ntuple-bridge ./native/ntuple-bridge
COPY --from=build --chown=1000:1000 /opt/ntuple/model ./model
COPY --from=build /opt/ntuple/compiler-version.txt ./
COPY --chown=1000:1000 server.py provenance.json ./
COPY TDL2048/LICENSE.md ./TDL2048-MIT.txt
USER 1000
ENV PYTHONUNBUFFERED=1 PORT=7860 BIND_HOST=0.0.0.0
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/ready',timeout=2)"
CMD ["python", "server.py"]
