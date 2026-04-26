{pkgs}: {
  deps = [
    pkgs.fontconfig
    pkgs.glib
    pkgs.xorg.libxcb
    pkgs.dbus
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.libxkbcommon
    pkgs.expat
    pkgs.mesa
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.nss
    pkgs.nspr
  ];
}
