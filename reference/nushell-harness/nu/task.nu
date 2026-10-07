# The entry point of every task. mise names the task and hands over its arguments; this runs the
# matching command in main.nu — `plugin:new demo` becomes `main.nu plugin new demo`. The arguments
# come through mise's `usage` variable because mise does not append them on Windows.
use lib.nu split-args

# Wrapped, and with a fallback: when mise does append the arguments (it does for some flags, such as
# --help), they arrive here and not in `usage_args`.
def --wrapped main [...appended: string] {
  let command = ($env.MISE_TASK_NAME | split row ":")
  let given = ($env.usage_args? | default "")
  let args = (if ($given | is-empty) { $appended } else { split-args $given })
  ^nu --no-config-file ($env.FILE_PWD | path join "main.nu") ...$command ...$args
}
