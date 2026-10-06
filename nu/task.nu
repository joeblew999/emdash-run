# The entry point of every task:  nu task.nu <command…>   runs   main.nu <command…> <the task's arguments>
#
# Why not let mise append the arguments? On Windows it does not: `mise run plugin:new -- demo`
# reaches the command with no `demo`. What works on every OS is mise's `usage` mechanism, which
# hands a task its arguments in one environment variable, shell-quoted. This reads it.
use lib.nu split-args

def --wrapped main [...command: string] {
  let args = (split-args ($env.usage_args? | default ""))
  ^nu --no-config-file ($env.FILE_PWD | path join "main.nu") ...$command ...$args
}
