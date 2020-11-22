"use strict";

$(document).ready(() => {
    $("#baord_file").on("change", (e) => {
        // var xhr = new XMLHttpRequest();
        // xhr.open('POST', '/load');

        // if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 0))
        // {
        //     console.log(xhr.responseText);
        // }

        let file = $(e.currentTarget)[0].files[0];
        let form = new FormData();
        form.append("file", file);

        // $.post("/load", form, (data) => {
        //     console.log(data);
        // });
        $.ajax({
            type: "POST",
            url: "/load",
            data: form,
            processData: false,
            contentType: false,
            success: function(data){
                window.location = `/b/${data}`;
            }
        });

        // xhr.send(form);
    });
});