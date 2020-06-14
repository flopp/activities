class ValueRange:
    def __init__(self):
        self._min = None
        self._max = None

    def __str__(self):
        if self.empty():
            return "[]"
        if self.singleton():
            return f"[{self.min()}]"
        return f"[{self.min()}, {self.max()}]"

    def empty(self):
        return self._min is None

    def singleton(self):
        return self._min == self._max

    def min(self):
        return self._min

    def max(self):
        return self._max

    def add(self, value):
        if self.empty():
            self._min = value
            self._max = value
        elif value < self._min:
            self._min = value
        elif value > self._max:
            self._max = value

    def adjust(self, delta_min, delta_max):
        if self.empty():
            return
        self._min += delta_min
        self._max += delta_max
        if self._min > self._max:
            self._min = None
            self._max = None

    def contains(self, value, slack=0):
        if self.empty():
            return False
        return self._min - slack <= value <= self._max + slack
