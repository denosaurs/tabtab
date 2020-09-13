import { Shell } from "./shell.ts";

export const scripts: Record<Shell, string> = {
  bash: `###-begin-{pkgname}-completion-###
  if type complete &>/dev/null; then
    _{pkgname}_completion () {
      local words cword
      if type _get_comp_words_by_ref &>/dev/null; then
        _get_comp_words_by_ref -n = -n @ -n : -w words -i cword
      else
        cword="$COMP_CWORD"
        words=("\${COMP_WORDS[@]}")
      fi
  
      local si="$IFS"
      IFS=$'\n' COMPREPLY=($(COMP_CWORD="$cword" \
                             COMP_LINE="$COMP_LINE" \
                             COMP_POINT="$COMP_POINT" \
                             {completer} completion -- "\${words[@]}" \
                             2>/dev/null)) || return $?
      IFS="$si"
      if type __ltrim_colon_completions &>/dev/null; then
        __ltrim_colon_completions "\${words[cword]}"
      fi
    }
    complete -o default -F _{pkgname}_completion {pkgname}
  fi
  ###-end-{pkgname}-completion-###`,
  fish: `###-begin-{pkgname}-completion-###
  function _{pkgname}_completion
    set cmd (commandline -o)
    set cursor (commandline -C)
    set words (node -pe "'$cmd'.split(' ').length")
  
    set completions (eval env DEBUG=\"" \"" COMP_CWORD=\""$words\"" COMP_LINE=\""$cmd \"" COMP_POINT=\""$cursor\"" {completer} completion -- $cmd)
  
    for completion in $completions
      echo -e $completion
    end
  end
  
  complete -f -d '{pkgname}' -c {pkgname} -a "(eval _{pkgname}_completion)"
  ###-end-{pkgname}-completion-###`,
  zsh: `###-begin-{pkgname}-completion-###
  if type compdef &>/dev/null; then
    _{pkgname}_completion () {
      local reply
      local si=$IFS
  
      IFS=$'\n' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" {completer} completion -- "\${words[@]}"))
      IFS=$si
  
      _describe 'values' reply
    }
    compdef _{pkgname}_completion {pkgname}
  fi
  ###-end-{pkgname}-completion-###
  `,
};
