FROM ubuntu:20.04 as build

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y git sudo tzdata expect-dev keyboard-configuration \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -U -m ardupilot && \
    usermod -G users ardupilot
RUN echo '%ardupilot ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
RUN mkdir /app && sudo chown -R ardupilot:ardupilot /app
USER ardupilot

WORKDIR /app
RUN git clone --recurse-submodules "https://github.com/ardupilot/ardupilot" ardupilot

WORKDIR /app/ardupilot

RUN USER=ardupilot ./Tools/environment_install/install-prereqs-ubuntu.sh -y
RUN ./waf configure --board sitl && ./waf rover

RUN echo "SR0_POSITION 10\nSR0_EXTRA1 10\nLOG_BACKEND_TYPE 0\nSIM_SPEEDUP 4\nBATT_CAPACITY 100000\nSIM_WIND_SPD 0\n" >> ./Tools/autotest/default_params/rover.parm

STOPSIGNAL SIGKILL
ENTRYPOINT bash -c "source ~/.profile && ./Tools/autotest/sim_vehicle.py --no-rebuild -v Rover -f motorboat -l 25.677760,-77.797865,0,0 --speedup=5 --mavproxy-args=--no-state --out=127.0.0.1:14550"