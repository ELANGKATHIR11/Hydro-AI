import fiona


def check_drivers():
    print("Available Fiona Drivers:")
    supported = fiona.supported_drivers

    gdb_drivers = {k: v for k, v in supported.items() if "GDB" in k}
    print("GDB-related drivers:")
    for k, v in gdb_drivers.items():
        print(f" - {k}: {v}")

    if not gdb_drivers:
        print("⚠️ No GDB drivers found! You cannot read .gdb files.")
    else:
        print("✅ GDB drivers are present.")


if __name__ == "__main__":
    check_drivers()
