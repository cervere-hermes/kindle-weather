// evgrab: take exclusive hold of input devices and print one line per finger press.
//
//   evgrab /dev/input/event1 [/dev/input/event2 ...]
//   -> "T <sec>.<usec>\n" on every touch-down, "K <code> <sec>.<usec>\n" on key presses
//
// While it runs, the Kindle UI receives no touches from the grabbed devices, so taps on
// the dashboard can't open anything underneath. Killing it releases the devices.
// It sleeps in poll() between events: no CPU use while idle.
//
// Freestanding (no libc) so it builds anywhere for 32-bit ARM Linux:
//   clang --target=armv7a-linux-gnueabihf -marm -mfloat-abi=soft -Os -ffreestanding \
//         -fno-stack-protector -nostdlib -c evgrab.c -o evgrab.o
//   rust-lld -flavor gnu -static -e _start -o evgrab evgrab.o

typedef unsigned int u32;
typedef int s32;
typedef unsigned short u16;

#define SYS_exit 1
#define SYS_read 3
#define SYS_write 4
#define SYS_open 5
#define SYS_ioctl 54
#define SYS_poll 168

#define EVIOCGRAB 0x40044590u
#define EV_KEY 1
#define EV_ABS 3
#define BTN_TOUCH 0x14a
#define ABS_MT_TRACKING_ID 0x39
#define MAXDEV 8

static long sys3(long n, long a, long b, long c) {
  register long r7 __asm__("r7") = n;
  register long r0 __asm__("r0") = a;
  register long r1 __asm__("r1") = b;
  register long r2 __asm__("r2") = c;
  __asm__ volatile("svc #0" : "+r"(r0) : "r"(r7), "r"(r1), "r"(r2) : "memory");
  return r0;
}

struct pollfd { s32 fd; short events; short revents; };
struct input_event { u32 sec; u32 usec; u16 type; u16 code; s32 value; };

static void out(const char *s, int n) { if (sys3(SYS_write, 1, (long)s, n) < 0) sys3(SYS_exit, 0, 0, 0); }
static int slen(const char *s) { int n = 0; while (s[n]) n++; return n; }
static int utoa(u32 v, char *b, int width) {
  char t[12]; int n = 0;
  do { t[n++] = '0' + v % 10; v /= 10; } while (v);
  while (n < width) t[n++] = '0';
  for (int i = 0; i < n; i++) b[i] = t[n - 1 - i];
  return n;
}
static void emit(char kind, int code, u32 sec, u32 usec) {
  char b[48]; int n = 0;
  b[n++] = kind; b[n++] = ' ';
  if (kind == 'K') { n += utoa((u32)code, b + n, 1); b[n++] = ' '; }
  n += utoa(sec, b + n, 1); b[n++] = '.'; n += utoa(usec, b + n, 6); b[n++] = '\n';
  out(b, n);
}

int cmain(long *sp) {
  int argc = (int)sp[0];
  char **argv = (char **)(sp + 1);
  struct pollfd p[MAXDEV];
  int down[MAXDEV];
  int n = 0;
  for (int i = 1; i < argc && n < MAXDEV; i++) {
    long fd = sys3(SYS_open, (long)argv[i], 0 /* O_RDONLY */, 0);
    if (fd < 0) continue;
    if (sys3(SYS_ioctl, fd, EVIOCGRAB, 1) != 0) { out("E grab ", 7); out(argv[i], slen(argv[i])); out("\n", 1); }
    p[n].fd = (s32)fd; p[n].events = 1 /* POLLIN */; p[n].revents = 0; down[n] = 0; n++;
  }
  if (!n) { out("E no devices\n", 13); return 1; }
  out("R\n", 2);  // ready: devices grabbed
  struct input_event ev[32];
  for (;;) {
    if (sys3(SYS_poll, (long)p, n, -1) < 0) continue;
    for (int d = 0; d < n; d++) {
      if (!(p[d].revents & 1)) continue;
      long r = sys3(SYS_read, p[d].fd, (long)ev, sizeof ev);
      if (r <= 0) continue;
      for (int k = 0; k < (int)(r / (long)sizeof(struct input_event)); k++) {
        struct input_event *e = &ev[k];
        int touchDown = -1;  // 1 = finger down, 0 = finger up
        if (e->type == EV_KEY && e->code == BTN_TOUCH) touchDown = e->value ? 1 : 0;
        else if (e->type == EV_ABS && e->code == ABS_MT_TRACKING_ID) touchDown = e->value >= 0 ? 1 : 0;
        else if (e->type == EV_KEY && e->value == 1) emit('K', e->code, e->sec, e->usec);
        if (touchDown == 1 && !down[d]) emit('T', 0, e->sec, e->usec);
        if (touchDown >= 0) down[d] = touchDown;
      }
    }
  }
}

__attribute__((naked, noreturn)) void _start(void) {
  __asm__ volatile(
      "mov r0, sp\n"
      "bl cmain\n"
      "mov r7, #1\n"
      "svc #0\n");
}
