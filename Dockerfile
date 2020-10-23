FROM node:10-buster

WORKDIR /app

# build audiowaveform from source

RUN apt update
RUN apt install -y git make cmake gcc g++ libmad0-dev libid3tag0-dev libsndfile1-dev libgd-dev libboost-dev libpng-dev zlib1g-dev
RUN apt install -y libboost-program-options-dev libboost-regex-dev libboost-filesystem-dev libboost-system-dev

RUN apt install -y autoconf automake libtool-bin gettext
RUN wget https://github.com/xiph/flac/archive/1.3.3.tar.gz
RUN tar xzf 1.3.3.tar.gz
RUN cd flac-1.3.3/ && ./autogen.sh
RUN cd flac-1.3.3/ && ./configure --enable-shared=no
RUN cd flac-1.3.3/ && make
RUN cd flac-1.3.3/ && make install

RUN git clone https://github.com/bbc/audiowaveform.git
RUN mkdir audiowaveform/build/
RUN cd audiowaveform/build/ && cmake -D ENABLE_TESTS=0 -D BUILD_STATIC=1 ..
RUN cd audiowaveform/build/ && make
RUN cd audiowaveform/build/ && make install

# install other requirements

RUN apt install -y graphicsmagick ffmpeg ghostscript

# install node package

COPY package*.json ./
RUN npm install
COPY . .

# start app

EXPOSE 9666
CMD ["node", "spacedeck.js"]

