FROM ubuntu:16.04

ARG uid=1000
ARG indy_stream=stable

ENV LC_ALL="C.UTF-8"
ENV LANG="C.UTF-8"
ENV SHELL="/bin/bash"
ENV LIBINDY_VERSION="1.8.1"
ENV NODE_VERSION=8

RUN apt-get update -y && apt-get install -y \
    apt-transport-https \
    build-essential \
    netcat \
    ca-certificates \
    cmake \
    curl \
    git \
    wget \
    libsodium-dev \
    libssl-dev \
    libsqlite3-dev \
    pkg-config \
    python3.5 \
    python3-pip \
    python-setuptools \
    python3-nacl


# Add indy user
RUN useradd -ms /bin/bash -u $uid indy

# Add required libindy and nodejs repositories
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 68DB5E88
RUN echo "deb https://repo.sovrin.org/sdk/deb xenial $indy_stream" >> /etc/apt/sources.list
RUN curl -sL "https://deb.nodesource.com/setup_$NODE_VERSION.x" | bash -

# Pin libindy version
RUN echo "Package: libindy" >> /etc/apt/preferences
RUN echo "Pin: version $LIBINDY_VERSION" >> /etc/apt/preferences
RUN echo "Pin-Priority: 1000" >> /etc/apt/preferences

# Install nodejs and libindy
RUN apt-get update && apt-get install -y libindy nodejs

USER indy
RUN mkdir /home/indy/app
RUN mkdir /home/indy/.indy_client
WORKDIR /home/indy/app

# install app dependencies
COPY --chown=indy:indy package.json package-lock.json /home/indy/app/
RUN npm install

# Copy rest of the app
COPY --chown=indy:indy . /home/indy/app/

VOLUME /home/indy/.indy_client

ENTRYPOINT ["/home/indy/app/docker-entrypoint.sh"]
CMD [ "npm", "start" ]
