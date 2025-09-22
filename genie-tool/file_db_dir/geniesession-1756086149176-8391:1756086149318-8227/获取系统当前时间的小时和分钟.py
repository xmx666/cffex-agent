import datetime

now = datetime.datetime.now()
current_time = f"{now.hour:02d}:{now.minute:02d}"
print(current_time)