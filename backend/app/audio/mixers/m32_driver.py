from app.audio.mixers.x32_driver import X32Driver


class M32Driver(X32Driver):
    mixer_type = "midas_m32"
    manufacturer = "Midas"
    model_name = "M32"

    def test_connection(self, ip: str, port: int = 10023, timeout_ms: int = 2000, retry_count: int = 1):
        result = super().test_connection(ip, port, timeout_ms, retry_count)
        if result.success:
            result.manufacturer = self.manufacturer
            result.model = self.model_name
            result.message = "Mixer Found"
        elif result.status == "wrong_device":
            result.message = "We found a device at this address, but it does not appear to be a Midas M32."
        return result
