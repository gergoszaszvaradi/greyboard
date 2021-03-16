"use strict";

jQuery(() => {
    $("#baord_file").on("change", (e) => {
        let files = ($(e.currentTarget)[0] as HTMLInputElement).files;
        if(files == null) return;
        let form = new FormData();
        form.append("file", files[0]);
        $(".loading").css("display", "flex").animate({
            opacity: 1
        }, 500);

        $.ajax({
            type: "POST",
            url: "/load",
            data: form,
            processData: false,
            contentType: false,
            success: function(data){
                window.location.pathname = `/b/${data}`;
            }
        });
    });
});