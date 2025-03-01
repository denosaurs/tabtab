###-begin-{pkgname}-completion-###
if type compdef &>/dev/null; then
  _{pkgname}_completion () {
    local reply
    local si=$IFS

    IFS=$'\n' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" {completer} {completion_cmd} -- "${words[@]}"))
    IFS=$si

    _describe 'values' reply
  }
  compdef _{pkgname}_completion {pkgname}
fi
###-end-{pkgname}-completion-###
